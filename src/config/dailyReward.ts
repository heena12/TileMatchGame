import type { WalletGrant } from '@state/progressStore';

/** Days in one reward cycle. After the last day the cycle starts again. */
export const DAILY_REWARD_CYCLE = 7;

/**
 * Reward for each day of the cycle (index 0 is day 1). Tune with playtest data.
 * Missing a whole day sends the player back to day 1.
 */
export const DAILY_REWARDS: readonly WalletGrant[] = [
  { coins: 20 },
  { coins: 30 },
  { coins: 40, boosters: { hint: 1 } },
  { coins: 50 },
  { coins: 60, boosters: { undo: 1 } },
  { coins: 80 },
  { coins: 100, boosters: { shuffle: 1 } },
];

/** A streak this long (or longer) is worth warning about. */
export const STREAK_WARNING_MIN = 2;
