import { getFreeTiles } from './board';
import { MATCH_SIZE, TRAY_SIZE } from './rules';
import { solve } from './solver';
import type { GameState, TileId } from './types';

/** How much searching a hint may do before falling back to a quick rule of thumb. */
export const HINT_NODE_BUDGET = 20000;

/**
 * A tile worth tapping now, or null when the game is over.
 *
 * First it searches for a winning line from the current position and
 * suggests its first tile, so following hints all the way wins whenever the
 * game is still winnable. If no line is found (a doomed position, or the
 * search budget ran out) it falls back to the natural choice: a tile that
 * completes a set in the tray, else one that joins a tile already there, else
 * a tile of a picture with the most free copies.
 */
export function findHint(state: GameState): TileId | null {
  if (state.status !== 'playing') {
    return null;
  }
  const free = getFreeTiles(state.board);
  if (free.length === 0) {
    return null;
  }

  const inTray = new Map<number, number>();
  for (const t of state.tray) {
    inTray.set(t.typeId, (inTray.get(t.typeId) ?? 0) + 1);
  }

  const result = solve(state.board, TRAY_SIZE, HINT_NODE_BUDGET, inTray);
  const first = result.solution?.[0];
  if (result.status === 'solvable' && first !== undefined) {
    return first;
  }

  const freeCopies = new Map<number, number>();
  for (const t of free) {
    freeCopies.set(t.typeId, (freeCopies.get(t.typeId) ?? 0) + 1);
  }
  const rank = (typeId: number) => {
    const waiting = inTray.get(typeId) ?? 0;
    if (waiting === MATCH_SIZE - 1) {
      return 0;
    }
    return waiting > 0 ? 1 : 2;
  };
  const best = [...free].sort(
    (a, b) =>
      rank(a.typeId) - rank(b.typeId) ||
      (freeCopies.get(b.typeId) ?? 0) - (freeCopies.get(a.typeId) ?? 0) ||
      a.id - b.id,
  )[0];
  return best ? best.id : null;
}
