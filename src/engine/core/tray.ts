import { MATCH_SIZE } from './rules';
import type { Tile } from './types';

/** Places the tile after the last tile of the same type, otherwise at the end. */
export function insertTile(tray: readonly Tile[], tile: Tile): Tile[] {
  let lastSameType = -1;
  tray.forEach((t, i) => {
    if (t.typeId === tile.typeId) {
      lastSameType = i;
    }
  });
  if (lastSameType === -1) {
    return [...tray, tile];
  }
  return [
    ...tray.slice(0, lastSameType + 1),
    tile,
    ...tray.slice(lastSameType + 1),
  ];
}

export interface MatchResult {
  readonly tray: readonly Tile[];
  readonly matched: readonly Tile[];
}

/** Removes the first group of MATCH_SIZE same-type tiles, shifting the rest left. */
export function extractMatch(tray: readonly Tile[]): MatchResult {
  const byType = new Map<number, Tile[]>();
  for (const tile of tray) {
    const group = byType.get(tile.typeId) ?? [];
    group.push(tile);
    byType.set(tile.typeId, group);
  }
  for (const group of byType.values()) {
    if (group.length >= MATCH_SIZE) {
      const matched = group.slice(0, MATCH_SIZE);
      const ids = new Set(matched.map(t => t.id));
      return { tray: tray.filter(t => !ids.has(t.id)), matched };
    }
  }
  return { tray, matched: [] };
}
