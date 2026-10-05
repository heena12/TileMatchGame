/**
 * Coins a revive costs after the first one. The reference game offers a
 * rewarded ad here; with no ad network connected, the first revive of an
 * attempt is free and later ones cost coins. Set to 0 to make every revive free.
 */
export const REVIVE_COST = 100;

/** Seconds the player has to decide before the level is counted as failed. */
export const REVIVE_COUNTDOWN_S = 5;

/** Coins the next revive costs, given how many were already used on this attempt. */
export function reviveCost(revivesUsed: number): number {
  return revivesUsed === 0 ? 0 : REVIVE_COST;
}
