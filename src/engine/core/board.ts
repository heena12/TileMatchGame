import type { Tile } from './types';

/** Two 1x1 tiles overlap when both axis offsets are under one cell. */
export function overlaps(a: Tile, b: Tile): boolean {
  return Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
}

/** A tile is free when no tile on a higher layer overlaps it. */
export function isFree(tile: Tile, board: readonly Tile[]): boolean {
  return !board.some(
    other =>
      other.id !== tile.id && other.layer > tile.layer && overlaps(other, tile),
  );
}

export function getFreeTiles(board: readonly Tile[]): Tile[] {
  return board.filter(tile => isFree(tile, board));
}
