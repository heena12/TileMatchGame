import { COINS_BASE, COINS_PER_STAR } from './constants';
import type { Stars } from './StarSystem';

export interface LevelReward {
  readonly stars: Stars;
  readonly coins: number;
  /** True when this run beat the previous best star count. */
  readonly improved: boolean;
}

/**
 * First clear pays 10 + 5 per star. A replay that earns more stars pays 5 per
 * extra star. Anything else pays nothing.
 * `previousBestStars` is 0 when the level has never been cleared.
 */
export function calculateReward(
  stars: Stars,
  previousBestStars: Stars,
): LevelReward {
  if (stars === 0 || stars <= previousBestStars) {
    return { stars, coins: 0, improved: false };
  }
  const coins =
    previousBestStars === 0
      ? COINS_BASE + COINS_PER_STAR * stars
      : COINS_PER_STAR * (stars - previousBestStars);
  return { stars, coins, improved: true };
}
