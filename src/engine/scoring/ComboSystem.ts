import { COMBO_BONUS_STEP, COMBO_MAX_LEVEL, COMBO_WINDOW } from './constants';

/**
 * Combo state. `level` 0 means no bonus. `lastMatchSelection` is the selection
 * number (1-based, accepted selections only) of the latest match, or null when
 * no combo window is open.
 */
export interface ComboState {
  readonly level: number;
  readonly lastMatchSelection: number | null;
}

export const initialCombo: ComboState = {
  level: 0,
  lastMatchSelection: null,
};

export interface MatchRegistration {
  readonly combo: ComboState;
  /** Extra points for this match from the combo. */
  readonly bonus: number;
}

/**
 * A match at `selection` chains when the previous match was at most
 * COMBO_WINDOW selections earlier. The first match has level 0 (no bonus).
 */
export function registerMatch(
  combo: ComboState,
  selection: number,
): MatchRegistration {
  const chained =
    combo.lastMatchSelection !== null &&
    selection - combo.lastMatchSelection <= COMBO_WINDOW;
  const level = chained ? Math.min(combo.level + 1, COMBO_MAX_LEVEL) : 0;
  return {
    combo: { level, lastMatchSelection: selection },
    bonus: level * COMBO_BONUS_STEP,
  };
}

/**
 * Call after a selection that did not produce a match. Once COMBO_WINDOW
 * selections have passed since the last match, the combo resets.
 */
export function registerMissedSelection(
  combo: ComboState,
  selection: number,
): ComboState {
  if (
    combo.lastMatchSelection !== null &&
    selection - combo.lastMatchSelection >= COMBO_WINDOW
  ) {
    return initialCombo;
  }
  return combo;
}
