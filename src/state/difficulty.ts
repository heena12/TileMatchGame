import type { Tile } from '@engine';

/** From this "feels hard" percentage up, a level opens with the warning popup. */
export const HARD_THRESHOLD = 50;

const MAX_TILES = 100;
const MAX_TYPES = 12;
const MAX_LAYERS = 4;

/**
 * How hard the level looks to players, 15..95, worked out from the opening
 * board: more tiles, more different pictures and more stacked layers all make
 * it harder. It changes from level to level, and is the same for the same level.
 */
export function hardPercent(board: readonly Tile[]): number {
  if (board.length === 0) {
    return 15;
  }
  const types = new Set(board.map(t => t.typeId)).size;
  const layers = board.reduce((top, t) => Math.max(top, t.layer + 1), 1);
  const score =
    15 +
    (Math.min(board.length, MAX_TILES) / MAX_TILES) * 40 +
    (Math.min(types, MAX_TYPES) / MAX_TYPES) * 25 +
    (Math.min(layers, MAX_LAYERS) / MAX_LAYERS) * 20;
  return Math.max(15, Math.min(95, Math.round(score)));
}

/**
 * "Only 17% players can pass this level": the share of players who get through,
 * taken as the opposite of how hard the level feels, never below 3% or above 85%.
 */
export function passPercent(hard: number): number {
  return Math.max(3, Math.min(85, 100 - hard));
}
