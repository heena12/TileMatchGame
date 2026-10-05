import { generateLevel } from '@engine';
import type { ILevelSource, LevelData } from '@engine';
import { BOOSTER_PRICES } from '@config/boosters';
import { RecordingAnalytics } from '@services/analytics/RecordingAnalytics';
import { RecordingAudio } from '@services/audio/RecordingAudio';
import { SystemClock } from '@services/clock/SystemClock';
import { RecordingHaptics } from '@services/haptics/RecordingHaptics';
import { createLevelSource } from '@services/levels/createLevelSource';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { FeedbackPlayer } from '@state/feedback';
import { GameController } from '@state/gameController';
import { createGameSessionStore } from '@state/gameSessionStore';
import { createProgressStore } from '@state/progressStore';
import { createSavedGameStore } from '@state/savedGameStore';
import { createSettingsStore } from '@state/settingsStore';
import { createTutorialStore } from '@state/tutorialStore';
import { finishGuidance, fixedSource, tinyLevel } from '../testUtils';

const preload = (inventory: Record<string, number>, coins: number) => {
  const storage = new InMemoryStorage();
  storage.setString(
    'player.progress',
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: 1,
      highestUnlockedLevel: 30,
      levels: {},
      wallet: { coins },
      inventory,
      tutorialCompleted: true,
    }),
  );
  return storage;
};

function boot(
  storage: InMemoryStorage,
  source: ILevelSource<LevelData> = fixedSource(tinyLevel),
  nextRandom = 0.5,
) {
  const analytics = new RecordingAnalytics();
  const audio = new RecordingAudio();
  const haptics = new RecordingHaptics();
  const session = createGameSessionStore();
  const progress = createProgressStore(storage, new SystemClock());
  const savedGame = createSavedGameStore(storage);
  const tutorial = createTutorialStore();
  const settings = createSettingsStore(storage);
  const controller = new GameController({
    levelSource: source,
    analytics,
    session,
    progress,
    feedback: new FeedbackPlayer({ audio, haptics, settings }),
    tutorial,
    savedGame,
    random: { next: () => nextRandom },
  });
  return {
    controller,
    analytics,
    audio,
    haptics,
    session,
    progress,
    savedGame,
    tutorial,
    settings,
  };
}

const tap = (c: GameController, ids: number[]) =>
  ids.forEach(id => c.select(id));
const big = fixedSource(() => generateLevel(120));

describe('Undo', () => {
  it('takes back the last tap, restores the score, and uses one from stock', async () => {
    const { controller, session, progress, analytics, audio } = boot(
      preload({ undo: 2 }, 0),
    );
    await controller.start(1);
    tap(controller, [1, 2]);
    const scoreAfterOne = session.getState().score.score;
    expect(controller.useBooster('undo')).toBe('used');

    const s = session.getState();
    expect(s.game?.tray.map(t => t.id)).toEqual([1]);
    expect(s.game?.board.map(t => t.id)).toContain(2);
    expect(s.freeTileIds).toContain(2);
    expect(s.score.score).toBe(scoreAfterOne - 10);
    expect(progress.getState().inventory.undo).toBe(1);
    expect(analytics.events).toContainEqual({
      name: 'booster_used',
      levelId: 1,
      booster: 'undo',
      paidWith: 'inventory',
    });
    expect(audio.played.at(-1)).toBe('undo');
  });

  it('buys one with coins when there is none in stock', async () => {
    const { controller, progress, analytics } = boot(preload({}, 100));
    await controller.start(1);
    tap(controller, [1]);
    expect(controller.useBooster('undo')).toBe('used');
    expect(progress.getState().coins).toBe(100 - BOOSTER_PRICES.undo);
    expect(analytics.events).toContainEqual(
      expect.objectContaining({ name: 'booster_used', paidWith: 'coins' }),
    );
  });

  it('refuses, changing nothing, when none in stock and not enough coins', async () => {
    const { controller, session, progress, audio } = boot(
      preload({}, BOOSTER_PRICES.undo - 1),
    );
    await controller.start(1);
    tap(controller, [1]);
    const game = session.getState().game;
    const played = audio.played.length;
    expect(controller.useBooster('undo')).toBe('unavailable');
    expect(session.getState().game).toBe(game);
    expect(progress.getState().coins).toBe(BOOSTER_PRICES.undo - 1);
    expect(audio.played).toHaveLength(played);
  });

  it('is not charged when there is nothing to undo', async () => {
    const { controller, progress } = boot(preload({ undo: 1 }, 50));
    await controller.start(1);
    expect(controller.useBooster('undo')).toBe('not_possible');
    expect(progress.getState().inventory.undo).toBe(1);
    expect(progress.getState().coins).toBe(50);
  });

  it('puts back a match with its points, and the combo still pays afterwards', async () => {
    const { controller, session } = boot(preload({ undo: 3 }, 0));
    await controller.start(1);
    tap(controller, [1, 2]);
    const beforeMatch = session.getState().score;
    tap(controller, [3]); // completes a set: +100
    expect(session.getState().score.matches).toBe(1);
    controller.useBooster('undo');
    expect(session.getState().score).toEqual(beforeMatch);
    expect(session.getState().game?.tray.map(t => t.id)).toEqual([1, 2]);

    // Play it out again: the same result as if the undo never happened.
    tap(controller, [3, 4, 5, 6]);
    expect(session.getState().status).toBe('won');
    expect(session.getState().score.score).toBe(510);
    expect(session.getState().score.comboBonusTotal).toBe(50);
  });

  it('is rejected after the level is won', async () => {
    const { controller, progress } = boot(preload({ undo: 3 }, 0));
    await controller.start(1);
    tap(controller, [1, 2, 3, 4, 5, 6]);
    expect(controller.useBooster('undo')).toBe('not_possible');
    expect(progress.getState().inventory.undo).toBe(3);
  });

  it('undoing several taps in a row walks all the way back', async () => {
    const { controller, session } = boot(preload({ undo: 5 }, 0));
    await controller.start(1);
    const start = session.getState().game;
    tap(controller, [1, 2, 3]);
    controller.useBooster('undo');
    controller.useBooster('undo');
    controller.useBooster('undo');
    expect(session.getState().game).toEqual(start);
    expect(session.getState().score.score).toBe(0);
  });

  it('is saved, so a resume reproduces the undone state', async () => {
    const storage = preload({ undo: 2 }, 0);
    const first = boot(storage);
    await first.controller.start(1);
    tap(first.controller, [1, 2, 4]);
    first.controller.useBooster('undo');
    expect(first.savedGame.getState().read()?.commands.at(-1)).toEqual({
      type: 'UNDO',
    });

    const second = boot(storage);
    await second.controller.start(1, { resume: true });
    expect(second.session.getState().game).toEqual(
      first.session.getState().game,
    );
    expect(second.session.getState().score).toEqual(
      first.session.getState().score,
    );
  });
});

describe('Shuffle', () => {
  it('re-deals the board with a seed taken from the random source', async () => {
    const { controller, session, savedGame } = boot(
      preload({ shuffle: 1 }, 0),
      big,
      0.25,
    );
    await controller.start(120);
    const before = session.getState().game?.board.map(t => t.typeId);
    expect(controller.useBooster('shuffle')).toBe('used');
    expect(session.getState().game?.board.map(t => t.typeId)).not.toEqual(
      before,
    );
    expect(savedGame.getState().read()?.commands.at(-1)).toEqual({
      type: 'SHUFFLE',
      seed: Math.floor(0.25 * 0x7fffffff),
    });
  });

  it('uses stock, then coins', async () => {
    const { controller, progress } = boot(preload({ shuffle: 1 }, 200), big);
    await controller.start(120);
    controller.useBooster('shuffle');
    expect(progress.getState().inventory.shuffle).toBe(0);
    expect(progress.getState().coins).toBe(200);
    controller.useBooster('shuffle');
    expect(progress.getState().coins).toBe(200 - BOOSTER_PRICES.shuffle);
  });

  it('cannot be undone past, and not charged when only one picture is left', async () => {
    const { controller, progress } = boot(preload({ shuffle: 1, undo: 1 }, 0));
    await controller.start(1);
    tap(controller, [1, 2, 3]); // picture 1 gone; only picture 2 left
    expect(controller.useBooster('shuffle')).toBe('not_possible');
    expect(progress.getState().inventory.shuffle).toBe(1);
  });

  it('starts a fresh undo history', async () => {
    const { controller, session } = boot(
      preload({ shuffle: 1, undo: 2 }, 0),
      big,
    );
    await controller.start(120);
    controller.select(session.getState().freeTileIds[0]!);
    controller.useBooster('shuffle');
    expect(controller.useBooster('undo')).toBe('not_possible');
  });

  it('a resume reproduces the exact shuffled board', async () => {
    const storage = preload({ shuffle: 1 }, 0);
    const first = boot(storage, big, 0.7);
    await first.controller.start(120);
    tap(first.controller, first.session.getState().freeTileIds.slice(0, 2));
    first.controller.useBooster('shuffle');
    tap(first.controller, first.session.getState().freeTileIds.slice(0, 1));

    const second = boot(storage, big, 0.1);
    await second.controller.start(120, { resume: true });
    expect(second.session.getState().game).toEqual(
      first.session.getState().game,
    );
    expect(second.session.getState().score).toEqual(
      first.session.getState().score,
    );
  });
});

describe('Wand (the middle booster)', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  const finish = () => jest.advanceTimersByTime(2000);

  it('uses one from stock and glows a set of three before sending it', async () => {
    const { controller, session, progress } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    expect(controller.useBooster('hint')).toBe('used');
    expect(session.getState().wandTileIds).toEqual([1, 2, 3]);
    expect(session.getState().game?.board).toHaveLength(6);
    expect(progress.getState().inventory.hint).toBe(0);
  });

  it('then sends the tiles to the tray one after another and matches them', async () => {
    const { controller, session } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    controller.useBooster('hint');
    jest.advanceTimersByTime(500);
    expect(session.getState().game?.board).toHaveLength(5);
    finish();
    expect(session.getState().game?.board).toHaveLength(3);
    expect(session.getState().game?.tray).toHaveLength(0);
    expect(session.getState().wandTileIds).toEqual([]);
    expect(session.getState().score.score).toBeGreaterThan(0);
  });

  it('prefers a full set of three from the board', async () => {
    const { controller, session } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    tap(controller, [1]);
    controller.useBooster('hint');
    expect(session.getState().wandTileIds).toEqual([4, 5, 6]);
  });

  it('collects only what is missing when that is all that is left', async () => {
    const { controller, session } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    tap(controller, [1, 4, 5]);
    controller.useBooster('hint');
    expect(session.getState().wandTileIds).toEqual([2, 3]);
  });

  it('can finish the level', async () => {
    const { controller, session } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    tap(controller, [4, 5, 6]);
    controller.useBooster('hint');
    finish();
    expect(session.getState().status).toBe('won');
  });

  it('ignores taps and boosters while the tiles are on their way', async () => {
    const { controller, session, progress } = boot(
      preload({ hint: 1, undo: 1 }, 0),
    );
    await controller.start(1);
    controller.useBooster('hint');
    controller.select(4);
    expect(session.getState().game?.board).toHaveLength(6);
    expect(controller.useBooster('undo')).toBe('not_possible');
    expect(progress.getState().inventory.undo).toBe(1);
    finish();
    expect(session.getState().game?.board).toHaveLength(3);
  });

  it('is recorded as HINT then three taps, so the run can be replayed', async () => {
    const { controller, savedGame } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    controller.useBooster('hint');
    expect(savedGame.getState().read()?.commands).toEqual([{ type: 'HINT' }]);
    jest.advanceTimersByTime(500);
    expect(savedGame.getState().read()?.commands).toEqual([
      { type: 'HINT' },
      { type: 'SELECT_TILE', tileId: 1 },
    ]);
  });

  it('stops quietly when the player leaves, and gives the booster back', async () => {
    const { controller, session, progress } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    controller.useBooster('hint');
    expect(progress.getState().inventory.hint).toBe(0);
    controller.quit();
    finish();
    expect(session.getState().game).toBeNull();
    expect(progress.getState().inventory.hint).toBe(1);
  });

  it('gives it back when the level is restarted part-way through', async () => {
    const { controller, session, progress } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    controller.useBooster('hint');
    jest.advanceTimersByTime(500); // first tile is on its way
    await controller.restart();
    finish();
    expect(progress.getState().inventory.hint).toBe(1);
    expect(session.getState().game?.board).toHaveLength(6);
  });

  it('does not give it back once every tile has been sent', async () => {
    const { controller, progress } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    controller.useBooster('hint');
    finish();
    controller.quit();
    expect(progress.getState().inventory.hint).toBe(0);
  });

  it('a late timer from the old level cannot disturb a new Wand', async () => {
    const { controller, session, progress } = boot(preload({ hint: 2 }, 0));
    await controller.start(1);
    controller.useBooster('hint');
    await controller.start(1);
    controller.useBooster('hint');
    finish();
    expect(session.getState().game?.board).toHaveLength(3);
    // One cancelled Wand came back; the second one was used.
    expect(progress.getState().inventory.hint).toBe(1);
  });

  it('is cleared when a level starts', async () => {
    const { controller, session } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    controller.useBooster('hint');
    await controller.start(1);
    expect(session.getState().wandTileIds).toEqual([]);
  });
});

describe('when a booster cannot be used', () => {
  it('does nothing without a running game', async () => {
    const { controller, progress } = boot(preload({ undo: 1, hint: 1 }, 100));
    expect(controller.useBooster('hint')).toBe('not_possible');
    expect(progress.getState().inventory.hint).toBe(1);
  });

  it('does nothing while a level is still loading', async () => {
    let release!: (l: LevelData) => void;
    const slow: ILevelSource<LevelData> = {
      getLevel: () => new Promise(res => (release = res)),
    };
    const { controller } = boot(preload({ hint: 1 }, 0), slow);
    const loading = controller.start(1);
    expect(controller.useBooster('hint')).toBe('not_possible');
    release(tinyLevel(1));
    await loading;
  });

  it('does nothing once the game is over', async () => {
    const { controller, progress } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    tap(controller, [1, 2, 3, 4, 5, 6]);
    expect(controller.useBooster('hint')).toBe('not_possible');
    expect(progress.getState().inventory.hint).toBe(1);
  });

  it('is locked while a tutorial step is showing, and never charged', async () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.progress',
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: 1,
        highestUnlockedLevel: 1,
        levels: {},
        wallet: { coins: 500 },
        inventory: { hint: 2 },
        tutorialCompleted: false,
      }),
    );
    const run = boot(storage, createLevelSource());
    await run.controller.start(1);
    expect(run.controller.useBooster('hint')).toBe('locked');
    expect(run.progress.getState().inventory.hint).toBe(2);
    expect(run.progress.getState().coins).toBe(500);

    finishGuidance(run.controller, run.tutorial);
    expect(run.controller.useBooster('hint')).toBe('used');
  });

  it('does nothing after the player quit', async () => {
    const { controller } = boot(preload({ hint: 1 }, 0));
    await controller.start(1);
    controller.quit();
    expect(controller.useBooster('hint')).toBe('not_possible');
  });
});

describe('boosters and stars', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });
  const noBoostersLevel = (id: number): LevelData => ({
    ...tinyLevel(id),
    noBoosters: true,
  });

  it('cost a star on a level that forbids them', async () => {
    const { controller, session } = boot(
      preload({ hint: 1 }, 0),
      fixedSource(noBoostersLevel),
    );
    await controller.start(1);
    controller.useBooster('hint');
    jest.advanceTimersByTime(2000);
    tap(controller, [4, 5, 6]);
    expect(session.getState().result?.stars).toBe(2);
  });

  it('do not, if none were used', async () => {
    const { controller, session } = boot(
      preload({ hint: 1 }, 0),
      fixedSource(noBoostersLevel),
    );
    await controller.start(1);
    tap(controller, [1, 2, 3, 4, 5, 6]);
    expect(session.getState().result?.stars).toBe(3);
  });

  it('are free to use on an ordinary level', async () => {
    const { controller, session } = boot(preload({ hint: 1, undo: 1 }, 0));
    await controller.start(1);
    controller.useBooster('hint');
    jest.advanceTimersByTime(2000);
    tap(controller, [4, 5]);
    controller.useBooster('undo');
    tap(controller, [5, 6]);
    expect(session.getState().result?.stars).toBe(3);
  });

  it('an undo that was rejected does not count against the no-boosters star', async () => {
    const { controller, session } = boot(
      preload({ undo: 1 }, 0),
      fixedSource(noBoostersLevel),
    );
    await controller.start(1);
    controller.useBooster('undo'); // nothing to undo
    tap(controller, [1, 2, 3, 4, 5, 6]);
    expect(session.getState().result?.stars).toBe(3);
  });
});

describe('sound and haptics for boosters', () => {
  it('plays a cue and a haptic for each', async () => {
    const { controller, audio, haptics, session } = boot(
      preload({ undo: 1, hint: 1, shuffle: 1 }, 0),
      big,
    );
    await controller.start(120);
    controller.select(session.getState().freeTileIds[0]!);
    controller.useBooster('undo');
    controller.useBooster('shuffle');
    controller.useBooster('hint');
    expect(audio.played.slice(-3)).toEqual(['undo', 'shuffle', 'hint']);
    expect(haptics.triggered.slice(-3)).toEqual(['light', 'medium', 'light']);
  });

  it('is silent with sound off, but the booster still works', async () => {
    const { controller, audio, settings, progress } = boot(
      preload({ hint: 1 }, 0),
    );
    settings.getState().setSoundEnabled(false);
    await controller.start(1);
    expect(controller.useBooster('hint')).toBe('used');
    expect(audio.played).toEqual([]);
    expect(progress.getState().inventory.hint).toBe(0);
  });
});
