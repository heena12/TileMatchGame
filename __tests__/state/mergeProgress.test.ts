import { SeededRandom } from '@engine';
import {
  PROGRESS_SCHEMA_VERSION,
  canonicalJson,
} from '@state/persistence/progressDocument';
import type { ProgressDocument } from '@state/persistence/progressDocument';
import { mergeProgress, sameProgress } from '@state/sync/mergeProgress';

const doc = (over: Partial<ProgressDocument> = {}): ProgressDocument => ({
  schemaVersion: PROGRESS_SCHEMA_VERSION,
  updatedAt: 0,
  highestUnlockedLevel: 1,
  levels: {},
  wallet: { coins: 0 },
  inventory: {},
  tutorialCompleted: false,
  dailyReward: { lastClaimDay: null, streak: 0 },
  ...over,
});

describe('mergeProgress: achievements only go up', () => {
  it('keeps the higher unlocked level', () => {
    expect(
      mergeProgress(
        doc({ highestUnlockedLevel: 12 }),
        doc({ highestUnlockedLevel: 30 }),
      ).highestUnlockedLevel,
    ).toBe(30);
  });

  it('takes the union of levels played on either device', () => {
    const merged = mergeProgress(
      doc({ levels: { 1: { stars: 3, bestScore: 900 } } }),
      doc({ levels: { 2: { stars: 1, bestScore: 300 } } }),
    );
    expect(merged.levels).toEqual({
      1: { stars: 3, bestScore: 900 },
      2: { stars: 1, bestScore: 300 },
    });
  });

  it('takes the higher stars and the higher best score for a shared level', () => {
    const merged = mergeProgress(
      doc({ levels: { 5: { stars: 3, bestScore: 400 } } }),
      doc({ levels: { 5: { stars: 1, bestScore: 900 } } }),
    );
    // Stars and score are compared separately: 3 stars from one, 900 from the other.
    expect(merged.levels[5]).toEqual({ stars: 3, bestScore: 900 });
  });

  it('is done with the tutorial if either device is', () => {
    expect(
      mergeProgress(doc({ tutorialCompleted: true }), doc()).tutorialCompleted,
    ).toBe(true);
    expect(
      mergeProgress(doc(), doc({ tutorialCompleted: true })).tutorialCompleted,
    ).toBe(true);
    expect(mergeProgress(doc(), doc()).tutorialCompleted).toBe(false);
  });

  it('never loses an achievement, in either direction', () => {
    const a = doc({
      highestUnlockedLevel: 40,
      levels: {
        1: { stars: 3, bestScore: 999 },
        39: { stars: 2, bestScore: 500 },
      },
    });
    const b = doc({
      highestUnlockedLevel: 15,
      levels: {
        1: { stars: 1, bestScore: 100 },
        14: { stars: 3, bestScore: 800 },
      },
    });
    for (const merged of [mergeProgress(a, b), mergeProgress(b, a)]) {
      expect(merged.highestUnlockedLevel).toBe(40);
      expect(merged.levels[1]).toEqual({ stars: 3, bestScore: 999 });
      expect(merged.levels[39]).toEqual({ stars: 2, bestScore: 500 });
      expect(merged.levels[14]).toEqual({ stars: 3, bestScore: 800 });
    }
  });
});

describe('mergeProgress: wallet and inventory follow the newer document', () => {
  it('takes coins and inventory together from the newer one', () => {
    const older = doc({
      updatedAt: 10,
      wallet: { coins: 500 },
      inventory: { undo: 5 },
    });
    const newer = doc({
      updatedAt: 20,
      wallet: { coins: 40 },
      inventory: { hint: 1 },
    });
    for (const merged of [
      mergeProgress(older, newer),
      mergeProgress(newer, older),
    ]) {
      expect(merged.wallet.coins).toBe(40);
      expect(merged.inventory).toEqual({ hint: 1 });
    }
  });

  it('does not bring back coins that were spent (the reason it is not "the larger")', () => {
    const beforeSpending = doc({ updatedAt: 10, wallet: { coins: 100 } });
    const afterSpending = doc({ updatedAt: 20, wallet: { coins: 10 } });
    expect(mergeProgress(beforeSpending, afterSpending).wallet.coins).toBe(10);
  });

  it('takes the newer timestamp', () => {
    expect(
      mergeProgress(doc({ updatedAt: 5 }), doc({ updatedAt: 9 })).updatedAt,
    ).toBe(9);
  });

  it('breaks an exact time tie the same way whichever order they come in', () => {
    const a = doc({
      updatedAt: 7,
      wallet: { coins: 30 },
      inventory: { undo: 1 },
    });
    const b = doc({
      updatedAt: 7,
      wallet: { coins: 55 },
      inventory: { undo: 9 },
    });
    const ab = mergeProgress(a, b);
    const ba = mergeProgress(b, a);
    expect(canonicalJson(ab)).toBe(canonicalJson(ba));
    expect(ab.wallet.coins).toBe(55);
  });

  it('breaks a tie on coins by inventory contents', () => {
    const a = doc({
      updatedAt: 7,
      wallet: { coins: 30 },
      inventory: { undo: 1 },
    });
    const b = doc({
      updatedAt: 7,
      wallet: { coins: 30 },
      inventory: { undo: 2 },
    });
    expect(canonicalJson(mergeProgress(a, b))).toBe(
      canonicalJson(mergeProgress(b, a)),
    );
  });

  it('does not depend on the order inventory keys were written in', () => {
    const a = doc({ updatedAt: 7, inventory: { undo: 1, hint: 2 } });
    const b = doc({ updatedAt: 7, inventory: { hint: 2, undo: 1 } });
    expect(canonicalJson(mergeProgress(a, b))).toBe(
      canonicalJson(mergeProgress(b, a)),
    );
  });
});

describe('mergeProgress: hygiene', () => {
  it('always returns the current schema version', () => {
    expect(mergeProgress(doc(), doc()).schemaVersion).toBe(
      PROGRESS_SCHEMA_VERSION,
    );
  });

  it('changes neither input', () => {
    const a = doc({
      levels: { 1: { stars: 1, bestScore: 1 } },
      inventory: { undo: 1 },
    });
    const b = doc({
      levels: { 1: { stars: 3, bestScore: 9 } },
      inventory: { hint: 4 },
      updatedAt: 5,
    });
    const before = canonicalJson([a, b]);
    mergeProgress(a, b);
    expect(canonicalJson([a, b])).toBe(before);
  });

  it('returns a new object, not one of its inputs', () => {
    const a = doc();
    expect(mergeProgress(a, doc())).not.toBe(a);
  });

  it('merging with an empty document changes nothing that matters', () => {
    const real = doc({
      updatedAt: 44,
      highestUnlockedLevel: 9,
      levels: { 3: { stars: 2, bestScore: 250 } },
      wallet: { coins: 70 },
      inventory: { undo: 2 },
      tutorialCompleted: true,
    });
    expect(canonicalJson(mergeProgress(real, doc()))).toBe(canonicalJson(real));
    expect(canonicalJson(mergeProgress(doc(), real))).toBe(canonicalJson(real));
  });
});

describe('sameProgress', () => {
  it('is true for the same content in a different key order', () => {
    expect(
      sameProgress(
        doc({
          inventory: { a: 1, b: 2 },
          levels: { 1: { stars: 1, bestScore: 2 } },
        }),
        doc({
          levels: { 1: { bestScore: 2, stars: 1 } },
          inventory: { b: 2, a: 1 },
        }),
      ),
    ).toBe(true);
  });

  it('is false when anything differs', () => {
    expect(sameProgress(doc(), doc({ updatedAt: 1 }))).toBe(false);
    expect(sameProgress(doc(), doc({ wallet: { coins: 1 } }))).toBe(false);
    expect(sameProgress(doc(), doc({ tutorialCompleted: true }))).toBe(false);
    expect(
      sameProgress(doc(), doc({ levels: { 1: { stars: 1, bestScore: 1 } } })),
    ).toBe(false);
  });
});

/** A random but valid document, with values chosen to collide often. */
function randomDoc(rng: SeededRandom): ProgressDocument {
  const int = (n: number) => Math.floor(rng.next() * n);
  const levels: Record<number, { stars: number; bestScore: number }> = {};
  const count = int(6);
  for (let i = 0; i < count; i++) {
    levels[1 + int(8)] = { stars: int(4), bestScore: int(5) * 100 };
  }
  const inventory: Record<string, number> = {};
  for (const name of ['undo', 'hint', 'shuffle']) {
    if (rng.next() < 0.5) {
      inventory[name] = int(4);
    }
  }
  return doc({
    updatedAt: int(4), // few values, so ties are common
    highestUnlockedLevel: 1 + int(20),
    levels,
    wallet: { coins: int(3) * 10 },
    inventory,
    tutorialCompleted: rng.next() < 0.5,
    dailyReward:
      rng.next() < 0.3
        ? { lastClaimDay: null, streak: 0 }
        : { lastClaimDay: int(4), streak: 1 + int(3) },
  });
}

describe('mergeProgress: devices always converge (property tests)', () => {
  const N = 400;
  const cases = () => {
    const rng = new SeededRandom(20250101);
    return Array.from(
      { length: N },
      () => [randomDoc(rng), randomDoc(rng), randomDoc(rng)] as const,
    );
  };

  it('is commutative: the order of the two documents does not matter', () => {
    for (const [a, b] of cases()) {
      expect(canonicalJson(mergeProgress(a, b))).toBe(
        canonicalJson(mergeProgress(b, a)),
      );
    }
  });

  it('is idempotent: merging again changes nothing', () => {
    for (const [a, b] of cases()) {
      const m = mergeProgress(a, b);
      expect(canonicalJson(mergeProgress(m, m))).toBe(canonicalJson(m));
      expect(canonicalJson(mergeProgress(m, a))).toBe(canonicalJson(m));
      expect(canonicalJson(mergeProgress(m, b))).toBe(canonicalJson(m));
    }
  });

  it('is associative: grouping three devices differently gives one answer', () => {
    for (const [a, b, c] of cases()) {
      const left = mergeProgress(mergeProgress(a, b), c);
      const right = mergeProgress(a, mergeProgress(b, c));
      expect(canonicalJson(left)).toBe(canonicalJson(right));
    }
  });

  it('every device ends up identical after syncing in any order', () => {
    for (const [a, b, c] of cases()) {
      const all = [a, b, c];
      const orders = [
        [0, 1, 2],
        [2, 0, 1],
        [1, 2, 0],
        [2, 1, 0],
      ];
      const results = orders.map(order =>
        canonicalJson(
          order.map(i => all[i] as ProgressDocument).reduce(mergeProgress),
        ),
      );
      expect(new Set(results).size).toBe(1);
    }
  });

  it('never has less than either input in any achievement', () => {
    for (const [a, b] of cases()) {
      const m = mergeProgress(a, b);
      expect(m.highestUnlockedLevel).toBeGreaterThanOrEqual(
        Math.max(a.highestUnlockedLevel, b.highestUnlockedLevel),
      );
      for (const source of [a, b]) {
        for (const [id, rec] of Object.entries(source.levels)) {
          expect(m.levels[Number(id)]?.stars ?? 0).toBeGreaterThanOrEqual(
            rec.stars,
          );
          expect(m.levels[Number(id)]?.bestScore ?? 0).toBeGreaterThanOrEqual(
            rec.bestScore,
          );
        }
      }
    }
  });
});
