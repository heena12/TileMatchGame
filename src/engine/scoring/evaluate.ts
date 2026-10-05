import type { Command } from '../commands/commands';
import type { LevelDefinition } from '../core/types';
import { GameEngine } from '../GameEngine';
import { applyEvents, initialScoreState } from './ScoreSystem';
import type { ScoreState } from './ScoreSystem';
import { calculateStars } from './StarSystem';
import type { StarThresholds, Stars } from './StarSystem';

export interface Evaluation {
  readonly score: ScoreState;
  readonly won: boolean;
  readonly stars: Stars;
}

/**
 * Recomputes the full result from a level and its command log. This is how a
 * server verifies a leaderboard score without trusting the client. Boosters
 * used are counted from the log.
 */
export function evaluateCommandLog(
  level: LevelDefinition,
  commands: readonly Command[],
  thresholds: StarThresholds,
): Evaluation {
  const engine = new GameEngine(level);
  let score = initialScoreState;
  for (const command of commands) {
    score = applyEvents(score, engine.dispatch(command));
  }
  const won = engine.getState().status === 'won';
  const stars = calculateStars({
    won,
    score: score.score,
    thresholds,
    // Counted from the log itself, so a server can enforce "no boosters" too.
    boostersUsed: engine.getBoostersUsed(),
  });
  return { score, won, stars };
}
