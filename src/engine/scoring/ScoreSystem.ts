import { TRAY_SIZE } from '../core/rules';
import type { GameEvent } from '../events/events';
import {
  ComboState,
  initialCombo,
  registerMatch,
  registerMissedSelection,
} from './ComboSystem';
import {
  CLEAR_BONUS_PER_UNUSED_SLOT,
  MATCH_POINTS,
  TILE_SELECT_POINTS,
} from './constants';

/** Immutable scoring snapshot, derived only from engine events. */
export interface ScoreState {
  readonly score: number;
  /** Accepted selections so far. */
  readonly selections: number;
  readonly matches: number;
  readonly comboBonusTotal: number;
  readonly combo: ComboState;
  /** Tiles currently in the tray, tracked from events. */
  readonly trayOccupancy: number;
  /** Most tiles the tray held at any point (right after an insertion). */
  readonly peakTray: number;
  readonly clearBonus: number;
  readonly completed: boolean;
  /**
   * The score as it was before the latest selection, so Undo can restore it
   * exactly (combo included, GAME_DESIGN 13.1). Null when there is nothing to
   * undo: at the start, and after a shuffle.
   */
  readonly previous: ScoreState | null;
}

export const initialScoreState: ScoreState = {
  score: 0,
  selections: 0,
  matches: 0,
  comboBonusTotal: 0,
  combo: initialCombo,
  trayOccupancy: 0,
  peakTray: 0,
  clearBonus: 0,
  completed: false,
  previous: null,
};

/** 50 points for every tray slot never used at the peak. */
export function calculateClearBonus(peakTray: number): number {
  return Math.max(0, TRAY_SIZE - peakTray) * CLEAR_BONUS_PER_UNUSED_SLOT;
}

/**
 * Folds the events of one engine step into the score. Pure: same events in the
 * same order always give the same result, so a server can recompute a score
 * from the command log. Call once per dispatch with that dispatch's events.
 */
export function applyEvents(
  state: ScoreState,
  events: readonly GameEvent[],
): ScoreState {
  // A revive takes several selections back; the score goes back with them.
  const revived = events.find(e => e.type === 'GAME_REVIVED');
  if (revived && revived.type === 'GAME_REVIVED') {
    let restored = state;
    for (let i = 0; i < revived.undone; i++) {
      restored = restored.previous ?? restored;
    }
    return restored;
  }
  // Taking a selection back restores the score from before it, whole.
  if (events.some(e => e.type === 'SELECTION_UNDONE')) {
    return state.previous ?? state;
  }

  let next = state;
  let selected = false;
  let matched = false;
  let shuffled = false;

  for (const event of events) {
    switch (event.type) {
      case 'TILE_SELECTED': {
        selected = true;
        const trayOccupancy = next.trayOccupancy + 1;
        next = {
          ...next,
          score: next.score + TILE_SELECT_POINTS,
          selections: next.selections + 1,
          trayOccupancy,
          peakTray: Math.max(next.peakTray, trayOccupancy),
        };
        break;
      }
      case 'TILES_MATCHED': {
        matched = true;
        const { combo, bonus } = registerMatch(next.combo, next.selections);
        next = {
          ...next,
          score: next.score + MATCH_POINTS + bonus,
          matches: next.matches + 1,
          comboBonusTotal: next.comboBonusTotal + bonus,
          combo,
          trayOccupancy: next.trayOccupancy - event.tileIds.length,
        };
        break;
      }
      case 'LEVEL_COMPLETED': {
        const clearBonus = calculateClearBonus(next.peakTray);
        next = {
          ...next,
          score: next.score + clearBonus,
          clearBonus,
          completed: true,
        };
        break;
      }
      case 'BOARD_SHUFFLED':
        shuffled = true;
        break;
      case 'GAME_OVER':
      case 'COMMAND_REJECTED':
      case 'SELECTION_UNDONE':
      case 'HINT_USED':
      case 'GAME_REVIVED':
        break;
    }
  }

  if (selected && !matched) {
    next = {
      ...next,
      combo: registerMissedSelection(next.combo, next.selections),
    };
  }
  if (selected) {
    next = { ...next, previous: state };
  }
  if (shuffled) {
    // The engine forgets its undo history on a shuffle; the score does too.
    next = { ...next, previous: null };
  }
  return next;
}

/** Combo level currently in effect (0 when no combo is running). */
export function currentComboLevel(state: ScoreState): number {
  return state.combo.level;
}
