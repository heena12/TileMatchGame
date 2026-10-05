import {
  DealError,
  SeededRandom,
  dealTypes,
  generateLevel,
  randomRemovalOrder,
  solve,
} from '@engine';
import { isFree } from '@engine/core/board';
import * as fromCore from '@engine/core/random';
import * as fromLevels from '@engine/levels/SeededRandom';
import * as solverCore from '@engine/core/solver';
import * as solverLevels from '@engine/levels/SolvabilityChecker';
import { tile } from './helpers';

const bare = (n: number) =>
  Array.from({ length: n }, (_, i) => tile(i + 1, 0, i, 0));

describe('moved modules keep their old import paths', () => {
  it('SeededRandom helpers are the same functions', () => {
    expect(fromLevels.SeededRandom).toBe(fromCore.SeededRandom);
    expect(fromLevels.hashSeed).toBe(fromCore.hashSeed);
    expect(fromLevels.shuffled).toBe(fromCore.shuffled);
    expect(fromLevels.randomInt).toBe(fromCore.randomInt);
  });

  it('the solver is the same function', () => {
    expect(solverLevels.solve).toBe(solverCore.solve);
  });
});

describe('randomRemovalOrder', () => {
  it('lists every tile once, each free at the moment it is taken', () => {
    const tiles = generateLevel(300).tiles;
    const order = randomRemovalOrder(tiles, new SeededRandom(5));
    expect(order).toHaveLength(tiles.length);
    expect(new Set(order.map(t => t.id)).size).toBe(tiles.length);

    let board = [...tiles];
    for (const t of order) {
      expect(isFree(t, board)).toBe(true);
      board = board.filter(b => b.id !== t.id);
    }
  });

  it('is deterministic for a seed', () => {
    const tiles = generateLevel(300).tiles;
    const a = randomRemovalOrder(tiles, new SeededRandom(9)).map(t => t.id);
    const b = randomRemovalOrder(tiles, new SeededRandom(9)).map(t => t.id);
    expect(a).toEqual(b);
  });
});

describe('dealTypes', () => {
  it('gives every tile a type and uses the pool exactly', () => {
    const order = bare(9);
    const dealt = dealTypes({
      order,
      pool: [4, 5, 6],
      initialOpen: [],
      slack: 3,
      interleave: 0.5,
      random: new SeededRandom(1),
    });
    expect(dealt.size).toBe(9);
    const counts = new Map<number, number>();
    dealt.forEach(type => counts.set(type, (counts.get(type) ?? 0) + 1));
    expect([...counts.entries()].sort()).toEqual([
      [4, 3],
      [5, 3],
      [6, 3],
    ]);
  });

  it('finishes groups that were already begun in the tray', () => {
    // One tile of type 7 is waiting, so two more are needed; plus one full group of type 8.
    const order = bare(5);
    const dealt = dealTypes({
      order,
      pool: [8],
      initialOpen: [{ type: 7, count: 1 }],
      slack: 0,
      interleave: 0.5,
      random: new SeededRandom(2),
    });
    const counts = new Map<number, number>();
    dealt.forEach(type => counts.set(type, (counts.get(type) ?? 0) + 1));
    expect(counts.get(7)).toBe(2);
    expect(counts.get(8)).toBe(3);
  });

  it('never lets the tray exceed the allowed size while following the order', () => {
    const level = generateLevel(500);
    const random = new SeededRandom(3);
    const order = randomRemovalOrder(
      level.tiles.map(t => ({ ...t, typeId: 0 })),
      random,
    );
    const pool = level.tiles.map(t => t.typeId).filter((_, i) => i % 3 === 0);
    const dealt = dealTypes({
      order,
      pool,
      initialOpen: [],
      slack: 1,
      interleave: 0.6,
      random,
    });
    let tray = 0;
    const waiting = new Map<number, number>();
    let peak = 0;
    for (const t of order) {
      const type = dealt.get(t.id) as number;
      const n = (waiting.get(type) ?? 0) + 1;
      tray += 1;
      peak = Math.max(peak, tray);
      if (n === 3) {
        waiting.set(type, 0);
        tray -= 3;
      } else {
        waiting.set(type, n);
      }
    }
    expect(peak).toBeLessThanOrEqual(6);
    expect(tray).toBe(0);
  });

  it('refuses to start when the tray is already too full', () => {
    const open = Array.from({ length: 6 }, (_, i) => ({
      type: i + 1,
      count: 1,
    }));
    expect(() =>
      dealTypes({
        order: bare(3),
        pool: [],
        initialOpen: open,
        slack: 0,
        interleave: 0.5,
        random: new SeededRandom(1),
      }),
    ).toThrow(DealError);
  });

  it('reports a dead end instead of returning a partial deal', () => {
    // Three tiles to deal but no group anywhere to put them in.
    expect(() =>
      dealTypes({
        order: bare(3),
        pool: [],
        initialOpen: [],
        slack: 0,
        interleave: 0.5,
        random: new SeededRandom(1),
      }),
    ).toThrow(/dead end/);
  });

  it('does not change the pool or the open groups it was given', () => {
    const pool = [1, 2];
    const initialOpen = [{ type: 9, count: 2 }];
    dealTypes({
      order: bare(7),
      pool,
      initialOpen,
      slack: 2,
      interleave: 0.5,
      random: new SeededRandom(4),
    });
    expect(pool).toEqual([1, 2]);
    expect(initialOpen).toEqual([{ type: 9, count: 2 }]);
  });
});

describe('solve from a partly played position', () => {
  it('counts tiles already in the tray', () => {
    // Two of type 1 wait; the last of type 1 is on the board.
    const board = [tile(1, 1, 0)];
    expect(solve(board, 3, 1000, new Map([[1, 2]])).status).toBe('solvable');
  });

  it('respects a tray that is already nearly full', () => {
    // Six different pictures waiting: taking a seventh new one loses.
    const board = [tile(1, 7, 0)];
    const tray = new Map(
      [1, 2, 3, 4, 5, 6].map(t => [t, 1] as [number, number]),
    );
    expect(solve(board, 7, 1000, tray).status).toBe('unsolvable');
  });

  it('starts from an empty tray when none is given', () => {
    const board = [tile(1, 1, 0), tile(2, 1, 1), tile(3, 1, 2)];
    expect(solve(board, 3, 1000).status).toBe('solvable');
  });
});
