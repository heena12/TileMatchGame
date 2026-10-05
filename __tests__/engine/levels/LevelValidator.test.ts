import {
  LEVEL_SCHEMA_VERSION,
  generateLevel,
  validateLevelData,
} from '@engine';
import type { LevelData } from '@engine';
import { row, tile } from '../helpers';

const three = (slack: number, tiles = row(1, 3, 1)): LevelData => ({
  schemaVersion: LEVEL_SCHEMA_VERSION,
  levelId: 1,
  tiles,
  twoStarScore: 400,
  threeStarScore: 500,
  validatedSlack: slack,
});

describe('validateLevelData', () => {
  it('accepts a level that is solvable at its claimed slack', () => {
    expect(validateLevelData(three(4))).toMatchObject({
      ok: true,
      status: 'ok',
    });
  });

  it('rejects a level whose claimed slack is too generous', () => {
    const r = validateLevelData(three(5));
    expect(r).toMatchObject({ ok: false, status: 'unsolvable' });
    expect(r.message).toMatch(/slack 5/);
  });

  it('reports rule violations as invalid', () => {
    const r = validateLevelData(three(0, row(1, 4, 1)));
    expect(r).toMatchObject({ ok: false, status: 'invalid' });
    expect(r.message).toMatch(/multiple of 3/);
  });

  it('rejects an out-of-range slack', () => {
    expect(validateLevelData(three(-1)).status).toBe('invalid');
    expect(validateLevelData(three(7)).status).toBe('invalid');
    expect(validateLevelData(three(1.5)).status).toBe('invalid');
  });

  it('treats an exhausted budget as a failure, never as valid', () => {
    const r = validateLevelData(generateLevel(1000), 2);
    expect(r).toMatchObject({ ok: false, status: 'budget_exhausted' });
    expect(r.message).toMatch(/budget/);
  });

  it('rethrows unexpected errors', () => {
    const broken = { ...three(0), tiles: null } as unknown as LevelData;
    expect(() => validateLevelData(broken)).toThrow();
  });

  it('detects a tampered generated level', () => {
    const level = generateLevel(150);
    const tiles = level.tiles.map((t, i) =>
      i === 0 ? tile(t.id, t.typeId + 100, t.x, t.y, t.layer) : t,
    );
    expect(validateLevelData({ ...level, tiles }).ok).toBe(false);
  });
});
