import { overlaps } from '../core/board';
import { DealError, dealTypes, randomRemovalOrder } from '../core/dealing';
import { validateLevel } from '../core/level';
import { MATCH_SIZE } from '../core/rules';
import type { Tile, TileSpec } from '../core/types';
import type { IRandom } from '../ports/IRandom';
import { defaultThresholds } from '../scoring/StarSystem';
import { getDifficultyConfig } from './DifficultyConfig';
import type { DifficultyConfig } from './DifficultyConfig';
import { LEVEL_SCHEMA_VERSION } from './LevelData';
import type { LevelData } from './LevelData';
import { DEFAULT_NODE_BUDGET, validateLevelData } from './LevelValidator';
import { SeededRandom, hashSeed, randomInt, shuffled } from './SeededRandom';

export class LevelGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelGenerationError';
  }
}

export interface GenerateOptions {
  /** Changes every generated level while keeping generation deterministic. */
  readonly baseSeed?: number;
  /** Run the solver on the result (tooling / CI). The app leaves this off. */
  readonly verify?: boolean;
  readonly nodeBudget?: number;
  readonly maxAttempts?: number;
}

const GRID_COLUMNS = 8;
const GRID_ROWS = 10;
const BASE_TYPE_COUNT = 30;
/** Half-cell offsets per layer, so upper layers straddle the layer below. */
const LAYER_OFFSETS: readonly (readonly [number, number])[] = [
  [0, 0],
  [0.5, 0.5],
  [0.5, 0],
  [0, 0.5],
  [0, 0],
  [0.5, 0.5],
];

interface Position {
  readonly x: number;
  readonly y: number;
  readonly layer: number;
}

function layerCounts(total: number, layers: number): number[] {
  const weights = Array.from({ length: layers }, (_, l) => layers - l);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map(w => Math.floor((total * w) / weightSum));
  let leftover = total - counts.reduce((a, b) => a + b, 0);
  for (let l = 0; leftover > 0; l = (l + 1) % layers, leftover--) {
    counts[l] = (counts[l] as number) + 1;
  }
  return counts;
}

/** The part of the 8 x 10 grid a level uses. Tutorial levels use all of it. */
interface BoardWindow {
  readonly columns: number;
  readonly rows: number;
  readonly left: number;
  readonly top: number;
}

/** How full the widest layer is. Higher means tiles pile onto each other more. */
const BASE_LAYER_FILL = 0.72;

/**
 * Past the tutorial, tiles are packed into a smaller, centred window instead of
 * being scattered over the whole grid. A tight pile means tiles really cover
 * each other, so far fewer are free at the start and the order matters. The
 * board is also drawn larger, because the app scales it to the tiles it holds.
 */
function boardWindow(config: DifficultyConfig): BoardWindow {
  if (config.tier === 'tutorial') {
    return { columns: GRID_COLUMNS, rows: GRID_ROWS, left: 0, top: 0 };
  }
  const widest = Math.max(...layerCounts(config.tileCount, config.layerCount));
  const needed = Math.ceil(widest / BASE_LAYER_FILL);
  const columns = Math.min(
    GRID_COLUMNS,
    Math.max(5, Math.ceil(Math.sqrt(needed * 0.8))),
  );
  const rows = Math.min(GRID_ROWS, Math.max(5, Math.ceil(needed / columns)));
  return {
    columns,
    rows,
    left: Math.floor((GRID_COLUMNS - columns) / 2),
    top: Math.floor((GRID_ROWS - rows) / 2),
  };
}

function layerSlots(layer: number, window: BoardWindow): Position[] {
  const [dx, dy] = LAYER_OFFSETS[layer % LAYER_OFFSETS.length] as [
    number,
    number,
  ];
  const slots: Position[] = [];
  for (let r = 0; r < window.rows; r++) {
    for (let c = 0; c < window.columns; c++) {
      const x = window.left + c + dx;
      const y = window.top + r + dy;
      if (
        x + 1 <= window.left + window.columns &&
        y + 1 <= window.top + window.rows
      ) {
        slots.push({ x, y, layer });
      }
    }
  }
  return slots;
}

function placeTiles(config: DifficultyConfig, random: IRandom): Position[] {
  const counts = layerCounts(config.tileCount, config.layerCount);
  const window = boardWindow(config);
  const placed: Position[] = [];
  counts.forEach((count, layer) => {
    const below = placed.filter(p => p.layer < layer) as unknown as Tile[];
    const slots = shuffled(random, layerSlots(layer, window));
    const sitting = slots.filter(s =>
      below.some(b => overlaps({ ...b } as Tile, { ...s, id: 0, typeId: 0 })),
    );
    const others = slots.filter(s => !sitting.includes(s));
    const chosen: Position[] = [];
    while (chosen.length < count) {
      const preferSitting = layer > 0 && random.next() < config.overlapDensity;
      const source =
        preferSitting && sitting.length > 0
          ? sitting
          : others.length > 0
          ? others
          : sitting;
      const next = source.pop();
      if (!next) {
        throw new LevelGenerationError(
          `Layer ${layer} cannot hold ${count} tiles`,
        );
      }
      chosen.push(next);
    }
    placed.push(...chosen);
  });
  return placed;
}

/**
 * Chooses which type each group of three gets (the same choices, in the same
 * order, as before the dealing code moved into the engine core), then hands
 * the actual dealing to the shared, tested implementation.
 */
function assignTypes(
  order: readonly Tile[],
  typeIds: readonly number[],
  slack: number,
  interleave: number,
  random: IRandom,
): Map<number, number> {
  const groupCount = order.length / MATCH_SIZE;
  const groupTypes = [...typeIds];
  while (groupTypes.length < groupCount) {
    groupTypes.push(typeIds[randomInt(random, typeIds.length)] as number);
  }
  const pool = shuffled(random, groupTypes);

  try {
    return dealTypes({
      order,
      pool,
      initialOpen: [],
      slack,
      interleave,
      random,
    });
  } catch (error) {
    if (error instanceof DealError) {
      throw new LevelGenerationError(error.message);
    }
    throw error;
  }
}

function build(levelId: number, seed: number): LevelData {
  const config = getDifficultyConfig(levelId);
  const random = new SeededRandom(seed);

  const positions = placeTiles(config, random);
  const bare: Tile[] = positions.map((p, i) => ({
    id: i + 1,
    typeId: 0,
    x: p.x,
    y: p.y,
    layer: p.layer,
  }));
  const order = randomRemovalOrder(bare, random);

  const typeIds = shuffled(
    random,
    Array.from({ length: BASE_TYPE_COUNT }, (_, i) => i + 1),
  ).slice(0, config.typeCount);
  const types = assignTypes(
    order,
    typeIds,
    config.requiredSlack,
    config.interleave,
    random,
  );

  const tiles: TileSpec[] = bare.map(t => ({
    ...t,
    typeId: types.get(t.id) as number,
  }));
  const thresholds = defaultThresholds(tiles.length);

  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    levelId,
    themeId: `theme-${Math.floor((levelId - 1) / 100) % 5}`,
    tiles,
    twoStarScore: thresholds.twoStarScore,
    threeStarScore: thresholds.threeStarScore,
    validatedSlack: config.requiredSlack,
  };
}

/**
 * Deterministic: the same (levelId, baseSeed) always returns the same level.
 * Levels are solvable by construction; `verify` additionally proves it with
 * the solver and retries with a new attempt seed if that fails.
 */
export function generateLevel(
  levelId: number,
  options: GenerateOptions = {},
): LevelData {
  const {
    baseSeed = 0,
    verify = false,
    nodeBudget = DEFAULT_NODE_BUDGET,
    maxAttempts = 8,
  } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const level = build(levelId, hashSeed(baseSeed, levelId, attempt));
    validateLevel(level);
    if (!verify || validateLevelData(level, nodeBudget).ok) {
      return level;
    }
  }
  throw new LevelGenerationError(
    `Could not produce a verified level ${levelId} in ${maxAttempts} attempts`,
  );
}
