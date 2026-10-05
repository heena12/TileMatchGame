import {
  GameEngine,
  applyEvents,
  calculateReward,
  calculateStars,
  initialScoreState,
  levelFingerprint,
} from '@engine';
import type {
  Command,
  ILevelSource,
  IRandom,
  LevelData,
  RunClaim,
  ScoreState,
  Stars,
  TileId,
} from '@engine';
import type { BoosterKind } from '@config/boosters';
import { reviveCost } from '@config/revive';
import type { IAnalytics } from '@services/analytics/IAnalytics';
/** How long the Wand's tiles glow before the first one is sent (ms). */
const WAND_GLOW_MS = 450;
/** Gap between the Wand's tiles, so their flights overlap like a stream (ms). */
const WAND_STEP_MS = 230;

import { cuesForEvents } from './feedback';
import { praiseFor } from './praise';
import { puzzleBonusFor } from './puzzle';
import type { IFeedback } from './feedback';
import type { GameSessionStore, StepRecord } from './gameSessionStore';
import type { ProgressStore } from './progressStore';
import type { SavedGameStore } from './savedGameStore';
import { currentStep, stepAllowsTile } from './tutorialStore';
import type { TutorialStore } from './tutorialStore';

/** A level that was just won, in a form that can be sent to a server for checking. */
export interface CompletedRun {
  readonly claim: RunClaim;
  /** True if this beats the player's best score on the level. */
  readonly newBest: boolean;
}

export interface GameControllerDeps {
  levelSource: ILevelSource<LevelData>;
  analytics: IAnalytics;
  session: GameSessionStore;
  progress: ProgressStore;
  feedback: IFeedback;
  tutorial: TutorialStore;
  savedGame: SavedGameStore;
  /** Where shuffle seeds come from. Injected so tests are repeatable. */
  random: IRandom;
  /** Called after a win, e.g. to queue the run for the leaderboard. Errors here never affect play. */
  onRunCompleted?: (run: CompletedRun) => void;
}

/**
 * What happened when the player asked for a booster.
 * - `used`: it worked and was paid for.
 * - `unavailable`: none in stock and not enough coins; nothing changed.
 * - `locked`: a tutorial step is showing; boosters wait until it is over.
 * - `not_possible`: it would do nothing right now (nothing to undo, no set for the Wand
 *   to give, nothing to shuffle, no game running); nothing was charged.
 */
export type BoosterOutcome = 'used' | 'unavailable' | 'locked' | 'not_possible';

export interface StartOptions {
  /** Force the guided steps even if the tutorial was completed (replay from Settings). */
  readonly guided?: boolean;
  /** Rebuild the saved game for this level instead of starting fresh. */
  readonly resume?: boolean;
}

interface Restored {
  readonly engine: GameEngine;
  readonly score: ScoreState;
  readonly moves: number;
}

/**
 * Runs one play session on behalf of the UI. Owns the GameEngine, so screens
 * never touch engine internals, and turns engine events into score, stars,
 * coins, saved progress, analytics, the step record that drives animation,
 * sound and haptics, and the tutorial's guidance.
 */
export class GameController {
  private engine: GameEngine | null = null;
  private level: LevelData | null = null;
  /** Fingerprint of the loaded level, stored with every save. */
  private fingerprint = '';
  /** Bumped on every start / quit so late async loads can be ignored. */
  private token = 0;
  /** Never reset, so a step seq is unique for the life of the app. */
  private stepSeq = 0;
  /** True while the Wand is sending its tiles; taps and boosters wait. */
  private wandRunning = false;
  /** Wand tiles not yet sent; if the Wand is cut short, the booster is given back. */
  private wandPending = 0;
  /** Remembered so Restart keeps a replayed tutorial guided. */
  private guided = false;

  constructor(private readonly deps: GameControllerDeps) {}

  /**
   * Gets sound ready while the app is idle (the splash screen), not on the
   * first move, and applies the Music setting. Call again after it changes.
   */
  warmUp(): void {
    this.deps.feedback.prime?.();
    this.deps.feedback.syncMusic?.();
  }

  /**
   * Builds a level ahead of time, while nothing else is going on, so opening
   * it does not have to. Failures are ignored; opening it later reports them.
   */
  prefetch(levelId: number): void {
    this.deps.levelSource.getLevel(levelId).catch(() => undefined);
  }

  async start(levelId: number, options: StartOptions = {}): Promise<void> {
    const { levelSource, analytics, session, tutorial } = this.deps;
    this.cancelWand();
    const token = ++this.token;
    this.engine = null;
    this.level = null;
    this.guided = options.guided === true;
    tutorial.getState().end();
    session.getState().patch({
      levelId,
      status: 'loading',
      game: null,
      freeTileIds: [],
      score: initialScoreState,
      result: null,
      puzzleBonus: 0,
      revivesUsed: 0,
      errorMessage: null,
      lastStep: null,
      wandTileIds: [],
    });

    try {
      const level = await levelSource.getLevel(levelId);
      if (token !== this.token) {
        return;
      }
      this.fingerprint = levelFingerprint(level);
      const restored = options.resume ? this.restore(level) : null;
      const engine = restored?.engine ?? new GameEngine(level);
      this.engine = engine;
      this.level = level;
      session.getState().patch({
        status: 'playing',
        game: engine.getState(),
        freeTileIds: engine.getFreeTileIds(),
        score: restored?.score ?? initialScoreState,
      });

      if (restored) {
        analytics.track({
          name: 'level_resume',
          levelId,
          moves: restored.moves,
        });
        return;
      }
      analytics.track({ name: 'level_start', levelId });

      const steps = level.tutorial ?? [];
      if (
        steps.length > 0 &&
        (this.guided || !this.deps.progress.getState().tutorialCompleted)
      ) {
        tutorial.getState().begin(levelId, steps);
      }
    } catch (error) {
      if (token !== this.token) {
        return;
      }
      session.getState().patch({
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Tap on a tile. While a tutorial step is showing, only the tile it
   * highlights is accepted; anything else just nudges. A rejected tap (covered
   * tile, game over) leaves the game untouched but still produces a step, so
   * the UI can shake the tile and play the reject cue.
   */
  select(tileId: number): void {
    if (this.wandRunning) {
      return;
    }
    this.selectNow(tileId);
  }

  /** Sends the Wand's tiles to the tray one after another, after they have glowed. */
  private runWand(ids: readonly TileId[]): void {
    const token = this.token;
    this.wandRunning = true;
    this.wandPending = ids.length;
    const send = (index: number) => {
      if (token !== this.token) {
        // Left or restarted: cancelWand() already dealt with it.
        return;
      }
      const id = ids[index];
      const stillOn =
        this.engine !== null &&
        this.deps.session.getState().status === 'playing';
      if (!stillOn || id === undefined) {
        this.cancelWand();
        return;
      }
      this.selectNow(id);
      this.wandPending--;
      if (index + 1 >= ids.length) {
        this.wandRunning = false;
        return;
      }
      setTimeout(() => send(index + 1), WAND_STEP_MS);
    };
    setTimeout(() => send(0), WAND_GLOW_MS);
  }

  /**
   * Stops a Wand that has not finished (the player left or restarted). Nothing
   * is lost: if tiles were still to be sent, the booster goes back to stock.
   */
  private cancelWand(): void {
    if (!this.wandRunning) {
      return;
    }
    this.wandRunning = false;
    if (this.wandPending > 0) {
      this.deps.progress.getState().credit({ boosters: { hint: 1 } });
    }
    this.wandPending = 0;
  }

  private selectNow(tileId: number): void {
    const { engine, level } = this;
    const { session, analytics, progress, feedback, tutorial, savedGame } =
      this.deps;
    if (!engine || !level) {
      return;
    }

    const guide = currentStep(tutorial.getState());
    if (guide && !stepAllowsTile(guide, tileId)) {
      tutorial.getState().nudge();
      return;
    }

    const before = session.getState();
    const tile = before.game?.board.find(t => t.id === tileId) ?? null;
    const events = engine.dispatch({ type: 'SELECT_TILE', tileId });
    const step: StepRecord = {
      seq: ++this.stepSeq,
      events,
      tile,
      trayBefore: before.game?.tray ?? [],
    };

    if (events.some(e => e.type === 'COMMAND_REJECTED')) {
      session.getState().patch({ lastStep: step });
      feedback.play(cuesForEvents(events, 0));
      return;
    }

    if (guide) {
      this.finishTutorialStep(level.levelId);
    }

    const score = applyEvents(before.score, events);
    const game = engine.getState();
    const base = {
      game,
      score,
      freeTileIds: engine.getFreeTileIds(),
      lastStep: { ...step, comboLevel: score.combo.level },
      wandTileIds: [],
    };
    feedback.play(cuesForEvents(events, score.combo.level));
    if (game.status === 'won') {
      feedback.speak?.('Brilliant!');
    } else if (events.some(e => e.type === 'TILES_MATCHED')) {
      feedback.speak?.(praiseFor(score.combo.level, step.seq).spoken);
    }

    if (game.status === 'won') {
      const stars = calculateStars({
        won: true,
        score: score.score,
        boostersUsed: engine.getBoostersUsed(),
        thresholds: {
          twoStarScore: level.twoStarScore,
          threeStarScore: level.threeStarScore,
          ...(level.noBoosters !== undefined
            ? { noBoosters: level.noBoosters }
            : {}),
        },
      });
      const firstClear =
        progress.getState().levels[level.levelId] === undefined;
      const previousBest = (progress.getState().levels[level.levelId]?.stars ??
        0) as Stars;
      const newBest =
        score.score >
        (progress.getState().levels[level.levelId]?.bestScore ?? 0);
      const reward = calculateReward(stars, previousBest);
      const puzzleBonus = puzzleBonusFor(level.levelId, firstClear);
      progress.getState().recordResult({
        levelId: level.levelId,
        stars,
        score: score.score,
        coins: reward.coins + puzzleBonus,
      });
      session
        .getState()
        .patch({ ...base, status: 'won', result: reward, puzzleBonus });
      tutorial.getState().end();
      savedGame.getState().clear();
      try {
        this.deps.onRunCompleted?.({
          claim: {
            levelId: level.levelId,
            levelContentVersion: this.fingerprint,
            commands: engine.getCommandLog(),
            score: score.score,
            stars,
          },
          newBest,
        });
      } catch {
        // Reporting is a side job; it must never get in the way of the result.
      }
      analytics.track({
        name: 'level_complete',
        levelId: level.levelId,
        stars,
        score: score.score,
        moves: game.moves,
      });
    } else if (game.status === 'lost') {
      session.getState().patch({ ...base, status: 'lost' });
      tutorial.getState().end();
      savedGame.getState().clear();
      analytics.track({
        name: 'level_fail',
        levelId: level.levelId,
        peakTray: score.peakTray,
        remainingTiles: game.board.length + game.tray.length,
      });
    } else {
      session.getState().patch(base);
      // Saved after every accepted move, so a kill at any moment loses nothing.
      savedGame.getState().save({
        levelId: level.levelId,
        levelContentVersion: this.fingerprint,
        commands: engine.getCommandLog(),
      });
    }
  }

  /**
   * A second chance on a lost game: takes back the last selections so the tray
   * has room again. The first revive of an attempt is free; later ones cost
   * REVIVE_COST coins. Nothing is spent unless it worked.
   */
  revive(): 'revived' | 'unavailable' | 'not_possible' {
    const { engine, level } = this;
    const { session, analytics, progress, feedback, savedGame } = this.deps;
    const before = session.getState();
    if (!engine || !level || before.status !== 'lost') {
      return 'not_possible';
    }
    // The first revive of an attempt is free, like the reference game's ad.
    const cost = reviveCost(before.revivesUsed);
    if (progress.getState().coins < cost) {
      return 'unavailable';
    }
    const events = engine.dispatch({ type: 'REVIVE' });
    if (events.some(e => e.type === 'COMMAND_REJECTED')) {
      return 'not_possible';
    }
    if (cost > 0) {
      progress.getState().spendCoins(cost);
    }
    const score = applyEvents(before.score, events);
    session.getState().patch({
      status: 'playing',
      game: engine.getState(),
      score,
      freeTileIds: engine.getFreeTileIds(),
      wandTileIds: [],
      revivesUsed: before.revivesUsed + 1,
      lastStep: {
        seq: ++this.stepSeq,
        events,
        tile: null,
        trayBefore: before.game?.tray ?? [],
      },
    });
    feedback.play(cuesForEvents(events, score.combo.level));
    savedGame.getState().save({
      levelId: level.levelId,
      levelContentVersion: this.fingerprint,
      commands: engine.getCommandLog(),
    });
    analytics.track({
      name: 'level_revive',
      levelId: level.levelId,
      coins: cost,
    });
    return 'revived';
  }

  /**
   * Uses a booster: the engine does the work (Undo and Shuffle change the
   * game, Hint points at a tile), the wallet pays for it. It is paid for only
   * once it has worked, so a booster that could do nothing never costs
   * anything. Coins are spent when none are in stock.
   */
  useBooster(kind: BoosterKind): BoosterOutcome {
    const { engine, level } = this;
    const { session, analytics, progress, feedback, tutorial, savedGame } =
      this.deps;
    const before = session.getState();
    if (!engine || !level || before.status !== 'playing' || this.wandRunning) {
      return 'not_possible';
    }
    // Tutorial steps assume an exact board; boosters would throw them off.
    if (currentStep(tutorial.getState())) {
      return 'locked';
    }
    if (!progress.getState().canAfford(kind)) {
      return 'unavailable';
    }

    let command: Command;
    let collectIds: TileId[] | null = null;
    switch (kind) {
      case 'undo':
        if (!engine.canUndo()) {
          return 'not_possible';
        }
        command = { type: 'UNDO' };
        break;
      case 'shuffle':
        if (!engine.canShuffle()) {
          return 'not_possible';
        }
        command = {
          type: 'SHUFFLE',
          seed: Math.floor(this.deps.random.next() * 0x7fffffff),
        };
        break;
      case 'hint': {
        // The Wand: glow a set of three, then send it to the tray.
        collectIds = engine.getCollectSet();
        if (collectIds === null) {
          return 'not_possible';
        }
        command = { type: 'HINT' };
        break;
      }
    }

    const events = engine.dispatch(command);
    if (events.some(e => e.type === 'COMMAND_REJECTED')) {
      return 'not_possible';
    }

    const score = applyEvents(before.score, events);
    session.getState().patch({
      game: engine.getState(),
      score,
      freeTileIds: engine.getFreeTileIds(),
      wandTileIds: collectIds ?? [],
      lastStep: {
        seq: ++this.stepSeq,
        events,
        tile: null,
        trayBefore: before.game?.tray ?? [],
      },
    });
    feedback.play(cuesForEvents(events, score.combo.level));
    // Saved before paying, so a kill in between never charges for nothing.
    savedGame.getState().save({
      levelId: level.levelId,
      levelContentVersion: this.fingerprint,
      commands: engine.getCommandLog(),
    });
    const paidWith = progress.getState().payForBooster(kind);
    analytics.track({
      name: 'booster_used',
      levelId: level.levelId,
      booster: kind,
      paidWith: paidWith ?? 'inventory',
    });
    if (collectIds) {
      this.runWand(collectIds);
    }
    return 'used';
  }

  /** "Got it" on a message-only tutorial step. */
  tutorialContinue(): void {
    const { tutorial } = this.deps;
    const guide = currentStep(tutorial.getState());
    if (!guide || guide.waitFor !== 'tap' || !this.level) {
      return;
    }
    this.finishTutorialStep(this.level.levelId);
  }

  /** "Skip tutorial": drop the guidance and remember it as done. */
  skipTutorial(): void {
    const { tutorial, progress, analytics } = this.deps;
    const state = tutorial.getState();
    if (!currentStep(state)) {
      return;
    }
    analytics.track({
      name: 'tutorial_skip',
      levelId: this.level?.levelId ?? state.levelId ?? 0,
      atStep: state.index,
    });
    tutorial.getState().end();
    progress.getState().completeTutorial();
  }

  /** Restart abandons this attempt, so its save goes too. */
  restart(): Promise<void> {
    const levelId = this.deps.session.getState().levelId;
    this.deps.savedGame.getState().clear();
    return levelId === null
      ? Promise.resolve()
      : this.start(levelId, { guided: this.guided });
  }

  /** Leave the level without finishing it. */
  quit(): void {
    // Leaving on purpose abandons a game in progress. Closing the app does not.
    if (this.deps.session.getState().status === 'playing') {
      this.deps.savedGame.getState().clear();
    }
    this.cancelWand();
    this.token++;
    this.engine = null;
    this.level = null;
    this.deps.tutorial.getState().end();
    this.deps.session.getState().reset();
  }

  /**
   * Rebuilds the saved game by replaying its commands on a fresh engine. The
   * engine is deterministic, so this gives back the exact board and tray, and
   * folding the same events gives back the score and combo. Anything doubtful
   * (other level, changed content, a command that no longer works, a game that
   * had already ended) discards the save and the level starts fresh.
   */
  private restore(level: LevelData): Restored | null {
    const { savedGame } = this.deps;
    const saved = savedGame.getState().read();
    if (!saved) {
      return null;
    }
    const usable =
      saved.levelId === level.levelId &&
      saved.levelContentVersion === this.fingerprint;
    if (usable) {
      const engine = new GameEngine(level);
      let score = initialScoreState;
      let valid = true;
      for (const command of saved.commands) {
        const events = engine.dispatch(command);
        if (events.some(e => e.type === 'COMMAND_REJECTED')) {
          valid = false;
          break;
        }
        score = applyEvents(score, events);
      }
      if (valid && engine.getState().status === 'playing') {
        return { engine, score, moves: saved.commands.length };
      }
    }
    savedGame.getState().clear();
    return null;
  }

  private finishTutorialStep(levelId: number): void {
    const { tutorial, analytics } = this.deps;
    const finished = tutorial.getState().index + 1;
    tutorial.getState().advance();
    analytics.track({ name: 'tutorial_step', levelId, step: finished });
  }
}
