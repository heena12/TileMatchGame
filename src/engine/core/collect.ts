import { getFreeTiles } from './board';
import { MATCH_SIZE } from './rules';
import { applyCommand } from './reducer';
import type { GameState, TileId } from './types';

/**
 * The tiles the Wand collects: free tiles of one picture that, tapped in
 * order, complete a set in the tray without losing the game. Prefers a full
 * set of three from the board (what the player sees fly in); if the tray
 * already holds copies, fewer tiles are enough. Null when no such set exists.
 *
 * Pure and deterministic. Each candidate is played out on the real rules, so a
 * set is only returned when every tap would be accepted.
 */
export function findCollectSet(state: GameState): TileId[] | null {
  if (state.status !== 'playing') {
    return null;
  }
  const inTray = new Map<number, number>();
  for (const t of state.tray) {
    inTray.set(t.typeId, (inTray.get(t.typeId) ?? 0) + 1);
  }
  const free = new Map<number, TileId[]>();
  for (const tile of [...getFreeTiles(state.board)].sort(
    (a, b) => a.id - b.id,
  )) {
    free.set(tile.typeId, [...(free.get(tile.typeId) ?? []), tile.id]);
  }

  let best: { ids: TileId[]; typeId: number } | null = null;
  for (const [typeId, ids] of [...free.entries()].sort((a, b) => a[0] - b[0])) {
    const needed = MATCH_SIZE - (inTray.get(typeId) ?? 0);
    if (needed < 1 || ids.length < needed) {
      continue;
    }
    const pick = ids.slice(0, needed);
    if (!completesSafely(state, pick)) {
      continue;
    }
    // A full set of three first; otherwise the one needing the most taps.
    if (!best || pick.length > best.ids.length) {
      best = { ids: pick, typeId };
    }
    if (best.ids.length === MATCH_SIZE) {
      break;
    }
  }
  return best ? best.ids : null;
}

function completesSafely(state: GameState, ids: readonly TileId[]): boolean {
  let current = state;
  let matched = false;
  for (const tileId of ids) {
    const result = applyCommand(current, { type: 'SELECT_TILE', tileId });
    if (!result.accepted || result.state.status === 'lost') {
      return false;
    }
    matched = result.events.some(e => e.type === 'TILES_MATCHED');
    current = result.state;
  }
  return matched;
}
