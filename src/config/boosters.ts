/** The three boosters. Names are also the keys of the saved inventory. */
export const BOOSTER_KINDS = ['undo', 'shuffle', 'hint'] as const;

export type BoosterKind = (typeof BOOSTER_KINDS)[number];

export function isBoosterKind(value: string): value is BoosterKind {
  return (BOOSTER_KINDS as readonly string[]).includes(value);
}

/**
 * Coins for one use when the player has none in stock (tune with playtest
 * data). Stronger effects cost more.
 */
export const BOOSTER_PRICES: Readonly<Record<BoosterKind, number>> = {
  hint: 20,
  undo: 30,
  shuffle: 40,
};

/** Given once, when the tutorial is finished or skipped, so new players have tried each. */
export const STARTER_BOOSTERS: Readonly<Record<BoosterKind, number>> = {
  undo: 1,
  shuffle: 1,
  hint: 1,
};
