import { SeededRandom, hashSeed } from '@engine';
import { randomInt, shuffled } from '@engine/levels/SeededRandom';

const take = (r: SeededRandom, n: number) =>
  Array.from({ length: n }, () => r.next());

describe('SeededRandom', () => {
  it('repeats the same sequence for the same seed', () => {
    expect(take(new SeededRandom(42), 20)).toEqual(
      take(new SeededRandom(42), 20),
    );
  });

  it('differs for different seeds', () => {
    expect(take(new SeededRandom(1), 5)).not.toEqual(
      take(new SeededRandom(2), 5),
    );
  });

  it('stays within [0, 1)', () => {
    for (const v of take(new SeededRandom(7), 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randomInt stays below the bound and reaches every value', () => {
    const r = new SeededRandom(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = randomInt(r, 5);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      seen.add(v);
    }
    expect(seen.size).toBe(5);
  });

  it('shuffled returns a deterministic permutation and keeps the input', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffled(new SeededRandom(9), input);
    const b = shuffled(new SeededRandom(9), input);
    expect(a).toEqual(b);
    expect([...a].sort((x, y) => x - y)).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});

describe('hashSeed', () => {
  it('is deterministic and order sensitive', () => {
    expect(hashSeed(1, 2, 3)).toBe(hashSeed(1, 2, 3));
    expect(hashSeed(1, 2, 3)).not.toBe(hashSeed(3, 2, 1));
    expect(hashSeed(0, 1, 0)).not.toBe(hashSeed(0, 2, 0));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = hashSeed(123456, 789);
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});
