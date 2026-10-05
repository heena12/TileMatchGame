import type { Command } from '../commands/commands';
import { GameEngine } from '../GameEngine';
import { levelFingerprint } from '../levels/fingerprint';
import type { LevelData } from '../levels/LevelData';
import { applyEvents, initialScoreState } from '../scoring/ScoreSystem';
import { calculateStars } from '../scoring/StarSystem';
import type { Stars } from '../scoring/StarSystem';

/** What a player claims: a finished level, with the moves that got them there. */
export interface RunClaim {
  readonly levelId: number;
  /** Fingerprint of the level the run was played on. */
  readonly levelContentVersion: string;
  readonly commands: readonly Command[];
  readonly score: number;
  readonly stars: number;
}

export type VerifyFailure =
  /** The run is for a different level, or the level's content has changed. */
  | 'LEVEL_MISMATCH'
  /** More commands than any real game needs. */
  | 'TOO_MANY_COMMANDS'
  /** A command in the log does not work on the board it claims to be played on. */
  | 'REJECTED_COMMAND'
  /** The moves do not end in a win. */
  | 'NOT_WON'
  | 'SCORE_MISMATCH'
  | 'STARS_MISMATCH';

export type VerifyResult =
  | {
      readonly valid: true;
      /** The score, stars and counts as recomputed here. Trust these, not the claim. */
      readonly score: number;
      readonly stars: Stars;
      readonly moves: number;
      readonly boostersUsed: number;
    }
  | { readonly valid: false; readonly reason: VerifyFailure };

/** Generous ceiling: a 150-tile board with plenty of undos is still far below this. */
export const MAX_RUN_COMMANDS = 5000;

/**
 * Checks a claimed run by replaying it. Pure and deterministic, so a server
 * can run it on submitted data without trusting the client at all: the score
 * and stars come from the engine, and the claim only has to agree with them.
 */
export function verifyRun(level: LevelData, claim: RunClaim): VerifyResult {
  if (
    claim.levelId !== level.levelId ||
    claim.levelContentVersion !== levelFingerprint(level)
  ) {
    return { valid: false, reason: 'LEVEL_MISMATCH' };
  }
  if (claim.commands.length > MAX_RUN_COMMANDS) {
    return { valid: false, reason: 'TOO_MANY_COMMANDS' };
  }

  const engine = new GameEngine(level);
  let score = initialScoreState;
  for (const command of claim.commands) {
    const events = engine.dispatch(command);
    // A real log holds only commands that worked. A rejected one means the
    // log was edited or belongs to a different board.
    if (events.some(e => e.type === 'COMMAND_REJECTED')) {
      return { valid: false, reason: 'REJECTED_COMMAND' };
    }
    score = applyEvents(score, events);
  }

  const state = engine.getState();
  if (state.status !== 'won') {
    return { valid: false, reason: 'NOT_WON' };
  }

  const boostersUsed = engine.getBoostersUsed();
  const stars = calculateStars({
    won: true,
    score: score.score,
    boostersUsed,
    thresholds: {
      twoStarScore: level.twoStarScore,
      threeStarScore: level.threeStarScore,
      ...(level.noBoosters !== undefined
        ? { noBoosters: level.noBoosters }
        : {}),
    },
  });

  if (claim.score !== score.score) {
    return { valid: false, reason: 'SCORE_MISMATCH' };
  }
  if (claim.stars !== stars) {
    return { valid: false, reason: 'STARS_MISMATCH' };
  }
  return {
    valid: true,
    score: score.score,
    stars,
    moves: state.moves,
    boostersUsed,
  };
}
