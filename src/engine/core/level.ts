import { overlaps } from './board';
import { MATCH_SIZE } from './rules';
import type { GameState, LevelDefinition } from './types';

export class LevelValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelValidationError';
  }
}

/** Throws LevelValidationError when the level cannot be played by the rules. */
export function validateLevel(level: LevelDefinition): void {
  const { tiles } = level;
  if (tiles.length === 0) {
    throw new LevelValidationError('Level has no tiles');
  }

  const ids = new Set<number>();
  const typeCounts = new Map<number, number>();
  for (const tile of tiles) {
    if (ids.has(tile.id)) {
      throw new LevelValidationError(`Duplicate tile id ${tile.id}`);
    }
    ids.add(tile.id);
    typeCounts.set(tile.typeId, (typeCounts.get(tile.typeId) ?? 0) + 1);
  }

  for (const [typeId, count] of typeCounts) {
    if (count % MATCH_SIZE !== 0) {
      throw new LevelValidationError(
        `Tile type ${typeId} has ${count} tiles; must be a multiple of ${MATCH_SIZE}`,
      );
    }
  }

  for (let i = 0; i < tiles.length; i++) {
    for (let j = i + 1; j < tiles.length; j++) {
      const a = tiles[i];
      const b = tiles[j];
      if (a && b && a.layer === b.layer && overlaps(a, b)) {
        throw new LevelValidationError(
          `Tiles ${a.id} and ${b.id} overlap on layer ${a.layer}`,
        );
      }
    }
  }
}

export function createInitialState(level: LevelDefinition): GameState {
  return {
    levelId: level.levelId,
    status: 'playing',
    board: [...level.tiles],
    tray: [],
    moves: 0,
    history: [],
  };
}
