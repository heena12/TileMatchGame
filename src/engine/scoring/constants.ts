/** Scoring tuning values. See GAME_DESIGN.md sections 5 and 13. */
export const TILE_SELECT_POINTS = 10;
export const MATCH_POINTS = 100;

/** A match chains if it happens within this many selections of the previous match. */
export const COMBO_WINDOW = 3;
export const COMBO_BONUS_STEP = 50;
export const COMBO_MAX_LEVEL = 5;

export const CLEAR_BONUS_PER_UNUSED_SLOT = 50;

export const COINS_BASE = 10;
export const COINS_PER_STAR = 5;

/** Star thresholds for generated levels, as percentages of the reference score (integers avoid float rounding). */
export const TWO_STAR_PERCENT = 120;
export const THREE_STAR_PERCENT = 160;
