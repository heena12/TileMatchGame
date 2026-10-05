import {
  GameEngine,
  LevelGenerationError,
  generateLevel,
  getDifficultyConfig,
  solve,
  validateLevelData,
} from '@engine';
import type { LevelData } from '@engine';

const SAMPLE_IDS = [
  1, 5, 10, 11, 50, 100, 101, 300, 500, 501, 1000, 2000, 2001, 2010, 5000,
  10000,
];

function typeCounts(level: LevelData): Map<number, number> {
  const counts = new Map<number, number>();
  level.tiles.forEach(t =>
    counts.set(t.typeId, (counts.get(t.typeId) ?? 0) + 1),
  );
  return counts;
}

describe('generateLevel invariants', () => {
  const ids = [...SAMPLE_IDS, ...Array.from({ length: 60 }, (_, i) => i + 1)];

  it.each(ids)('level %i follows its difficulty config', id => {
    const config = getDifficultyConfig(id);
    const level = generateLevel(id);
    expect(level.levelId).toBe(id);
    expect(level.tiles).toHaveLength(config.tileCount);
    expect(level.validatedSlack).toBe(config.requiredSlack);
    expect(new Set(level.tiles.map(t => t.id)).size).toBe(config.tileCount);

    const counts = typeCounts(level);
    expect(counts.size).toBe(config.typeCount);
    counts.forEach(c => expect(c % 3).toBe(0));

    const maxLayer = Math.max(...level.tiles.map(t => t.layer));
    expect(maxLayer).toBeLessThan(config.layerCount);
    level.tiles.forEach(t => {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.x + 1).toBeLessThanOrEqual(8);
      expect(t.y).toBeGreaterThanOrEqual(0);
      expect(t.y + 1).toBeLessThanOrEqual(10);
    });
    expect(level.twoStarScore).toBeGreaterThan(0);
    expect(level.threeStarScore).toBeGreaterThan(level.twoStarScore);
  });

  it('uses half-cell offsets so upper layers overlap lower ones', () => {
    const level = generateLevel(600);
    expect(level.tiles.some(t => t.x % 1 !== 0 || t.y % 1 !== 0)).toBe(true);
  });
});

describe('generateLevel determinism', () => {
  it('returns identical levels for the same id and seed', () => {
    expect(generateLevel(777)).toEqual(generateLevel(777));
    expect(generateLevel(777, { baseSeed: 5 })).toEqual(
      generateLevel(777, { baseSeed: 5 }),
    );
  });

  it('differs across ids and across base seeds', () => {
    expect(generateLevel(40)).not.toEqual(generateLevel(41));
    expect(generateLevel(40, { baseSeed: 1 }).tiles).not.toEqual(
      generateLevel(40, { baseSeed: 2 }).tiles,
    );
  });

  it('assigns a theme from the level id', () => {
    expect(generateLevel(1).themeId).toBe('theme-0');
    expect(generateLevel(150).themeId).toBe('theme-1');
  });
});

describe('generated levels are solvable', () => {
  it.each(SAMPLE_IDS)('level %i passes the solver at its slack', id => {
    expect(validateLevelData(generateLevel(id)).status).toBe('ok');
  });

  it.each([1, 60, 400, 1500, 3000])(
    'the solver solution wins in the real engine (level %i)',
    id => {
      const level = generateLevel(id);
      const result = solve(level.tiles, 7 - level.validatedSlack, 200_000);
      expect(result.status).toBe('solvable');
      const engine = new GameEngine(level);
      for (const tileId of result.solution ?? []) {
        engine.dispatch({ type: 'SELECT_TILE', tileId });
      }
      expect(engine.getState().status).toBe('won');
    },
  );

  it('verify mode returns a level the validator accepts', () => {
    expect(validateLevelData(generateLevel(2500, { verify: true })).ok).toBe(
      true,
    );
  });

  it('gives up with a clear error when no attempt is allowed', () => {
    expect(() => generateLevel(10, { verify: true, maxAttempts: 0 })).toThrow(
      LevelGenerationError,
    );
  });

  it('gives up when verification keeps failing', () => {
    expect(() =>
      generateLevel(1000, { verify: true, nodeBudget: 1, maxAttempts: 2 }),
    ).toThrow(/2 attempts/);
  });
});
