import { overlaps } from './board';
import { MATCH_SIZE, TRAY_SIZE } from './rules';
import type { Tile, TileId } from './types';

export type SolveStatus = 'solvable' | 'unsolvable' | 'budget_exhausted';

export interface SolveResult {
  readonly status: SolveStatus;
  readonly nodes: number;
  /** Winning pick order when solvable. */
  readonly solution?: readonly TileId[];
}

/**
 * Searches for a winning sequence in which the tray never holds more than
 * `maxTray` tiles (measured right after an insertion) and never fills up
 * without a match. Depth-first with memoization on the set of remaining tiles:
 * the tray contents follow from that set, so it fully identifies a state.
 * Running out of `nodeBudget` is reported as 'budget_exhausted', never as solvable.
 *
 * `initialTray` (tile type -> how many are already waiting in the tray) lets the
 * search start from a game that is partly played. `tiles` are then the tiles
 * still on the board.
 */
export function solve(
  tiles: readonly Tile[],
  maxTray: number,
  nodeBudget: number,
  initialTray: ReadonlyMap<number, number> = new Map(),
): SolveResult {
  const n = tiles.length;
  const blockerCount = new Array<number>(n).fill(0);
  const blocks: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = tiles[i] as Tile;
      const b = tiles[j] as Tile;
      if (i !== j && b.layer > a.layer && overlaps(a, b)) {
        blockerCount[i] = (blockerCount[i] as number) + 1;
        (blocks[j] as number[]).push(i);
      }
    }
  }

  const remaining = new Array<boolean>(n).fill(true);
  const trayCount = new Map<number, number>(initialTray);
  const nonMatchLimit = Math.min(maxTray, TRAY_SIZE - 1);
  const failed = new Set<string>();
  const path: TileId[] = [];
  let nodes = 0;
  let occupancy = 0;
  initialTray.forEach(count => {
    occupancy += count;
  });
  let exhausted = false;
  let remainingCount = n;

  const keyOf = () => remaining.map(r => (r ? '1' : '0')).join('');

  const candidates = (): number[] => {
    const freeByType = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      if (remaining[i] && blockerCount[i] === 0) {
        const typeId = (tiles[i] as Tile).typeId;
        freeByType.set(typeId, (freeByType.get(typeId) ?? 0) + 1);
      }
    }

    const scored: {
      index: number;
      rank: number;
      notReady: number;
      unblocks: number;
    }[] = [];
    for (let i = 0; i < n; i++) {
      if (!remaining[i] || blockerCount[i] !== 0) {
        continue;
      }
      const typeId = (tiles[i] as Tile).typeId;
      const inTray = trayCount.get(typeId) ?? 0;
      const completes = inTray === MATCH_SIZE - 1;
      const limit = completes ? maxTray : nonMatchLimit;
      if (occupancy + 1 > limit) {
        continue;
      }
      const unblocks = (blocks[i] as number[]).filter(
        k => blockerCount[k] === 1,
      ).length;
      // "Ready": enough copies of this type are free right now to finish the group.
      const ready = (freeByType.get(typeId) ?? 0) >= MATCH_SIZE - inTray;
      scored.push({
        index: i,
        rank: completes ? 0 : inTray > 0 ? 1 : 2,
        notReady: ready ? 0 : 1,
        unblocks,
      });
    }
    scored.sort(
      (a, b) =>
        a.rank - b.rank ||
        a.notReady - b.notReady ||
        b.unblocks - a.unblocks ||
        a.index - b.index,
    );
    return scored.map(s => s.index);
  };

  const search = (): boolean => {
    if (remainingCount === 0) {
      return true;
    }
    const key = keyOf();
    if (failed.has(key)) {
      return false;
    }
    if (nodes >= nodeBudget) {
      exhausted = true;
      return false;
    }
    nodes++;

    for (const i of candidates()) {
      const tile = tiles[i] as Tile;
      const before = trayCount.get(tile.typeId) ?? 0;
      const completes = before === MATCH_SIZE - 1;
      const occBefore = occupancy;

      remaining[i] = false;
      remainingCount--;
      for (const k of blocks[i] as number[]) {
        blockerCount[k] = (blockerCount[k] as number) - 1;
      }
      if (completes) {
        trayCount.set(tile.typeId, 0);
        occupancy = occBefore - (MATCH_SIZE - 1);
      } else {
        trayCount.set(tile.typeId, before + 1);
        occupancy = occBefore + 1;
      }
      path.push(tile.id);

      if (search()) {
        return true;
      }

      path.pop();
      trayCount.set(tile.typeId, before);
      occupancy = occBefore;
      for (const k of blocks[i] as number[]) {
        blockerCount[k] = (blockerCount[k] as number) + 1;
      }
      remainingCount++;
      remaining[i] = true;

      if (exhausted) {
        return false;
      }
    }

    failed.add(key);
    return false;
  };

  const ok = search();
  if (ok) {
    return { status: 'solvable', nodes, solution: [...path] };
  }
  return { status: exhausted ? 'budget_exhausted' : 'unsolvable', nodes };
}
