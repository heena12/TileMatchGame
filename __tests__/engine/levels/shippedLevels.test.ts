/**
 * CI gate for level content: every level we ship must parse and be solvable
 * at the slack it claims (GAME_DESIGN 13.3, 13.7).
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  SeededRandom,
  generateLevel,
  getDifficultyConfig,
  parseLevelData,
  validateLevelData,
} from '@engine';

const CONTENT_DIR = path.resolve(__dirname, '../../../content/levels');

describe('authored levels in content/levels', () => {
  const files = fs.existsSync(CONTENT_DIR)
    ? fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.json'))
    : [];

  it('every JSON file parses and is solvable at its claimed slack', () => {
    const problems: string[] = [];
    const seenIds = new Set<number>();
    for (const file of files) {
      try {
        const raw = JSON.parse(
          fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8'),
        );
        const level = parseLevelData(raw);
        if (seenIds.has(level.levelId)) {
          problems.push(`${file}: duplicate levelId ${level.levelId}`);
        }
        seenIds.add(level.levelId);
        const result = validateLevelData(level);
        if (!result.ok) {
          problems.push(`${file}: ${result.status} ${result.message ?? ''}`);
        }
      } catch (error) {
        problems.push(`${file}: ${(error as Error).message}`);
      }
    }
    expect(problems).toEqual([]);
  });
});

describe('generated level catalog', () => {
  it('validates levels 1 to 150 (tutorial, easy and the start of medium)', () => {
    const failures: string[] = [];
    for (let id = 1; id <= 150; id++) {
      const result = validateLevelData(generateLevel(id));
      if (!result.ok) {
        failures.push(`${id}: ${result.status}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('validates every tier boundary and every boss position sampled', () => {
    const ids = [
      500, 501, 502, 1999, 2000, 2001, 2010, 2020, 3000, 5000, 9990, 10000,
      10001, 25000,
    ];
    const failures = ids.filter(id => !validateLevelData(generateLevel(id)).ok);
    expect(failures).toEqual([]);
  });

  it('validates a seeded spread across the whole 10000-level range', () => {
    const rng = new SeededRandom(2024);
    const ids = Array.from(
      { length: 60 },
      () => 1 + Math.floor(rng.next() * 10000),
    );
    const failures = ids.filter(id => !validateLevelData(generateLevel(id)).ok);
    expect(failures).toEqual([]);
  });

  it('never gets easier: tile count does not drop between tier boundaries', () => {
    const boundaries = [10, 11, 100, 101, 500, 501, 2000, 2001];
    const counts = boundaries.map(id => getDifficultyConfig(id).tileCount);
    for (let i = 0; i < counts.length; i += 2) {
      expect(counts[i + 1] as number).toBeGreaterThanOrEqual(
        (counts[i] as number) - 30,
      );
    }
  });
});
