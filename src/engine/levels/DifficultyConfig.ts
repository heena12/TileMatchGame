import { MATCH_SIZE } from '../core/rules';

export type Tier = 'tutorial' | 'easy' | 'medium' | 'hard' | 'expert';

export interface DifficultyConfig {
  readonly levelId: number;
  readonly tier: Tier;
  readonly isBoss: boolean;
  readonly typeCount: number;
  /** Always a multiple of 3 and at least 3 per type. */
  readonly tileCount: number;
  readonly layerCount: number;
  /** 0..1: how strongly upper layers prefer to sit on lower tiles. */
  readonly overlapDensity: number;
  /** Spare tray slots the level must keep (GAME_DESIGN 13.3). */
  readonly requiredSlack: number;
  /** 0..1: how often the solution keeps several types waiting in the tray. */
  readonly interleave: number;
}

type Range = readonly [number, number];

interface TierSpec {
  readonly tier: Tier;
  readonly from: number;
  readonly to: number;
  readonly types: Range;
  readonly tiles: Range;
  readonly layers: Range;
  readonly slack: number;
  readonly density: Range;
  readonly interleave: Range;
}

/**
 * GAME_DESIGN section 6, with slack from section 13.3. The tutorial is gentle;
 * from level 11 the game ramps up quickly (more tiles, more different pictures,
 * deeper stacks, tighter tray), so level 17 already needs real planning.
 */
const TIERS: readonly TierSpec[] = [
  {
    tier: 'tutorial',
    from: 1,
    to: 10,
    types: [3, 4],
    tiles: [18, 30],
    layers: [1, 2],
    slack: 3,
    density: [0.2, 0.3],
    interleave: [0.2, 0.35],
  },
  {
    tier: 'easy',
    from: 11,
    to: 30,
    types: [5, 7],
    tiles: [42, 60],
    layers: [3, 3],
    slack: 2,
    density: [0.4, 0.5],
    interleave: [0.4, 0.55],
  },
  {
    tier: 'medium',
    from: 31,
    to: 120,
    types: [7, 10],
    tiles: [60, 90],
    layers: [3, 4],
    slack: 1,
    density: [0.5, 0.65],
    interleave: [0.5, 0.7],
  },
  {
    tier: 'hard',
    from: 121,
    to: 500,
    types: [10, 14],
    tiles: [90, 120],
    layers: [4, 5],
    slack: 1,
    density: [0.6, 0.75],
    interleave: [0.6, 0.8],
  },
  {
    tier: 'expert',
    from: 501,
    to: 10000,
    types: [14, 20],
    tiles: [120, 150],
    layers: [5, 6],
    slack: 0,
    density: [0.7, 0.85],
    interleave: [0.7, 0.9],
  },
];

const BOSS_EVERY = 10;
const MAX_TYPES = 20;

function lerp(range: Range, t: number): number {
  return range[0] + (range[1] - range[0]) * t;
}

/** Difficulty is configuration, not code. Levels beyond 10000 keep expert settings. */
export function getDifficultyConfig(levelId: number): DifficultyConfig {
  if (!Number.isInteger(levelId) || levelId < 1) {
    throw new RangeError(`levelId must be a positive integer, got ${levelId}`);
  }
  const spec =
    TIERS.find(s => levelId <= s.to) ?? (TIERS[TIERS.length - 1] as TierSpec);
  const t = Math.min(
    1,
    Math.max(0, (levelId - spec.from) / (spec.to - spec.from)),
  );

  const isBoss = spec.tier === 'expert' && levelId % BOSS_EVERY === 0;
  const typeCount = isBoss ? MAX_TYPES : Math.round(lerp(spec.types, t));
  const rawTiles = Math.round(lerp(spec.tiles, t) / MATCH_SIZE) * MATCH_SIZE;
  const tileCount = Math.max(rawTiles, typeCount * MATCH_SIZE);

  return {
    levelId,
    tier: spec.tier,
    isBoss,
    typeCount,
    tileCount,
    layerCount: Math.round(lerp(spec.layers, t)),
    overlapDensity: lerp(spec.density, t),
    requiredSlack: spec.slack,
    interleave: lerp(spec.interleave, t),
  };
}
