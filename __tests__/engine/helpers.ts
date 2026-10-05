import type { LevelDefinition, TileSpec } from '@engine';

export const tile = (
  id: number,
  typeId: number,
  x = id,
  y = 0,
  layer = 0,
): TileSpec => ({ id, typeId, x, y, layer });

export const level = (tiles: TileSpec[], levelId = 1): LevelDefinition => ({
  levelId,
  tiles,
});

/** `count` tiles of one type in a row on layer 0, ids starting at `startId`. */
export const row = (typeId: number, count: number, startId: number, y = 0) =>
  Array.from({ length: count }, (_, i) =>
    tile(startId + i, typeId, startId + i, y),
  );
