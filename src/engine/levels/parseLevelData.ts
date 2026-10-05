import { validateLevel } from '../core/level';
import type { TileSpec } from '../core/types';
import { LEVEL_SCHEMA_VERSION, LevelDataError } from './LevelData';
import type { LevelData, TutorialStep } from './LevelData';

type Obj = Record<string, unknown>;

function isObject(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function num(obj: Obj, key: string, where: string): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new LevelDataError(`${where}.${key} must be a finite number`);
  }
  return value;
}

function parseTile(raw: unknown, index: number): TileSpec {
  if (!isObject(raw)) {
    throw new LevelDataError(`tiles[${index}] must be an object`);
  }
  const where = `tiles[${index}]`;
  return {
    id: num(raw, 'id', where),
    typeId: num(raw, 'typeId', where),
    x: num(raw, 'x', where),
    y: num(raw, 'y', where),
    layer: num(raw, 'layer', where),
  };
}

function parseStep(
  raw: unknown,
  index: number,
  tileIds: ReadonlySet<number>,
): TutorialStep {
  const where = `tutorial[${index}]`;
  if (!isObject(raw)) {
    throw new LevelDataError(`${where} must be an object`);
  }
  const { messageKey, waitFor, highlightTileIds } = raw;
  if (typeof messageKey !== 'string' || messageKey.length === 0) {
    throw new LevelDataError(`${where}.messageKey must be a non-empty string`);
  }
  if (waitFor !== 'select' && waitFor !== 'tap') {
    throw new LevelDataError(`${where}.waitFor must be "select" or "tap"`);
  }
  if (
    !Array.isArray(highlightTileIds) ||
    !highlightTileIds.every(id => typeof id === 'number')
  ) {
    throw new LevelDataError(`${where}.highlightTileIds must be numbers`);
  }
  if (waitFor === 'select' && highlightTileIds.length === 0) {
    throw new LevelDataError(
      `${where} waits for a selection but highlights none`,
    );
  }
  const unknown = highlightTileIds.find(id => !tileIds.has(id));
  if (unknown !== undefined) {
    throw new LevelDataError(`${where} highlights unknown tile ${unknown}`);
  }
  return { messageKey, waitFor, highlightTileIds: [...highlightTileIds] };
}

/**
 * Turns untrusted JSON into LevelData. Checks the schema and the game rules
 * (tile counts, overlaps). Solvability is checked offline by the validator.
 */
export function parseLevelData(raw: unknown): LevelData {
  if (!isObject(raw)) {
    throw new LevelDataError('Level must be an object');
  }
  const schemaVersion = num(raw, 'schemaVersion', 'level');
  if (schemaVersion !== LEVEL_SCHEMA_VERSION) {
    throw new LevelDataError(
      `Unsupported schemaVersion ${schemaVersion}; expected ${LEVEL_SCHEMA_VERSION}`,
    );
  }
  const rawTiles = raw.tiles;
  if (!Array.isArray(rawTiles)) {
    throw new LevelDataError('level.tiles must be an array');
  }
  const themeId = raw.themeId;
  if (themeId !== undefined && typeof themeId !== 'string') {
    throw new LevelDataError('level.themeId must be a string');
  }
  const noBoosters = raw.noBoosters;
  if (noBoosters !== undefined && typeof noBoosters !== 'boolean') {
    throw new LevelDataError('level.noBoosters must be a boolean');
  }

  const rawTutorial = raw.tutorial;
  if (rawTutorial !== undefined && !Array.isArray(rawTutorial)) {
    throw new LevelDataError('level.tutorial must be an array');
  }

  const level: LevelData = {
    schemaVersion,
    levelId: num(raw, 'levelId', 'level'),
    tiles: rawTiles.map(parseTile),
    twoStarScore: num(raw, 'twoStarScore', 'level'),
    threeStarScore: num(raw, 'threeStarScore', 'level'),
    validatedSlack: num(raw, 'validatedSlack', 'level'),
    ...(themeId !== undefined ? { themeId } : {}),
    ...(noBoosters !== undefined ? { noBoosters } : {}),
  };

  if (level.threeStarScore < level.twoStarScore) {
    throw new LevelDataError('threeStarScore must be >= twoStarScore');
  }
  try {
    validateLevel(level);
  } catch (error) {
    throw new LevelDataError(
      error instanceof Error ? error.message : 'Invalid level',
    );
  }
  if (rawTutorial === undefined) {
    return level;
  }
  const tileIds = new Set(level.tiles.map(t => t.id));
  return {
    ...level,
    tutorial: rawTutorial.map((step, i) => parseStep(step, i, tileIds)),
  };
}
