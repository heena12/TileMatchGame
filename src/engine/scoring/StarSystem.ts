import {
  MATCH_POINTS,
  THREE_STAR_PERCENT,
  TILE_SELECT_POINTS,
  TWO_STAR_PERCENT,
} from './constants';
import { MATCH_SIZE } from '../core/rules';

export type Stars = 0 | 1 | 2 | 3;

export interface StarThresholds {
  readonly twoStarScore: number;
  readonly threeStarScore: number;
  /** When true, 3 stars additionally requires that no booster was used. */
  readonly noBoosters?: boolean;
}

export interface StarInput {
  readonly won: boolean;
  readonly score: number;
  readonly thresholds: StarThresholds;
  readonly boostersUsed?: number;
}

/** Score for clearing `tileCount` tiles with no combo and no clear bonus. */
export function referenceScore(tileCount: number): number {
  return (
    TILE_SELECT_POINTS * tileCount +
    MATCH_POINTS * Math.floor(tileCount / MATCH_SIZE)
  );
}

/** Default thresholds for generated levels. Reaching them takes combos. */
export function defaultThresholds(tileCount: number): StarThresholds {
  const ref = referenceScore(tileCount);
  return {
    twoStarScore: Math.ceil((ref * TWO_STAR_PERCENT) / 100),
    threeStarScore: Math.ceil((ref * THREE_STAR_PERCENT) / 100),
  };
}

/** 0 stars on a loss, 1 for a clear, 2 and 3 by score. */
export function calculateStars(input: StarInput): Stars {
  if (!input.won) {
    return 0;
  }
  const { thresholds, score } = input;
  const boostersOk = !thresholds.noBoosters || (input.boostersUsed ?? 0) === 0;
  if (score >= thresholds.threeStarScore && boostersOk) {
    return 3;
  }
  if (score >= thresholds.twoStarScore) {
    return 2;
  }
  return 1;
}
