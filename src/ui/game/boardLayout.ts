import type { Tile } from '@engine';

/** Logical board from GAME_DESIGN section 4. */
export const BOARD_COLUMNS = 8;
export const BOARD_ROWS = 10;

/** Pixels each layer is lifted, to suggest stacking before real depth art exists. */
export const LAYER_LIFT = 3;

export interface BoardMetrics {
  /** Side of one logical cell in pixels. */
  readonly cell: number;
  readonly width: number;
  readonly height: number;
}

/** Largest whole-pixel cell that fits the whole 8 x 10 board in the available area. */
export function computeBoardMetrics(
  availableWidth: number,
  availableHeight: number,
  columns: number = BOARD_COLUMNS,
  rows: number = BOARD_ROWS,
): BoardMetrics {
  const cell = Math.max(
    1,
    Math.floor(Math.min(availableWidth / columns, availableHeight / rows)),
  );
  return { cell, width: cell * columns, height: cell * rows };
}

/** Top-left of the area a level actually uses, in logical cells. */
export interface BoardOrigin {
  readonly x: number;
  readonly y: number;
}

/** Cells a level occupies: its tiles, each one cell wide and tall. */
export interface BoardExtent extends BoardOrigin {
  readonly columns: number;
  readonly rows: number;
}

export const FULL_EXTENT: BoardExtent = {
  x: 0,
  y: 0,
  columns: BOARD_COLUMNS,
  rows: BOARD_ROWS,
};

/**
 * The smallest box holding every tile, so a small level is drawn large instead
 * of floating in a corner of the full 8 x 10 board. Never wider than the board.
 */
export function boardExtent(
  tiles: readonly Pick<Tile, 'x' | 'y'>[],
): BoardExtent {
  if (tiles.length === 0) {
    return FULL_EXTENT;
  }
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const t of tiles) {
    minX = Math.min(minX, t.x);
    maxX = Math.max(maxX, t.x);
    minY = Math.min(minY, t.y);
    maxY = Math.max(maxY, t.y);
  }
  return {
    x: minX,
    y: minY,
    columns: Math.min(BOARD_COLUMNS, maxX - minX + 1),
    rows: Math.min(BOARD_ROWS, maxY - minY + 1),
  };
}

export interface TileRect {
  readonly left: number;
  readonly top: number;
  readonly size: number;
}

export function tileRect(
  tile: Pick<Tile, 'x' | 'y' | 'layer'>,
  cell: number,
  origin: BoardOrigin = { x: 0, y: 0 },
): TileRect {
  return {
    left: (tile.x - origin.x) * cell,
    top: (tile.y - origin.y) * cell - tile.layer * LAYER_LIFT,
    size: cell,
  };
}

/** Draw order: lower layers first so upper layers paint on top. */
export function byDrawOrder(a: Tile, b: Tile): number {
  return a.layer - b.layer || a.id - b.id;
}
