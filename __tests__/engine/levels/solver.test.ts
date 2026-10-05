import { GameEngine, applyEvents, initialScoreState, solve } from '@engine';
import type { LevelDefinition } from '@engine';
import { level, row, tile } from '../helpers';

describe('solve', () => {
  it('solves a trivial row of three', () => {
    const r = solve(row(1, 3, 1), 7, 1000);
    expect(r.status).toBe('solvable');
    expect(r.solution).toHaveLength(3);
  });

  it('respects layers: covered tiles are picked after the ones on top', () => {
    const tiles = [
      tile(1, 1, 0, 0, 0),
      tile(2, 1, 0.5, 0, 1),
      tile(3, 1, 5, 0, 0),
    ];
    const r = solve(tiles, 7, 1000);
    expect(r.status).toBe('solvable');
    const solution = r.solution ?? [];
    expect(solution.indexOf(2)).toBeLessThan(solution.indexOf(1));
  });

  it('reports unsolvable when the tray would fill without a match', () => {
    const seven = Array.from({ length: 7 }, (_, i) => tile(i + 1, i + 1));
    expect(solve(seven, 7, 1000).status).toBe('unsolvable');
  });

  it('honours the tray limit passed in', () => {
    const tiles = row(1, 3, 1);
    expect(solve(tiles, 3, 1000).status).toBe('solvable');
    expect(solve(tiles, 2, 1000).status).toBe('unsolvable');
  });

  it('reports budget exhaustion instead of guessing', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      row(i + 1, 3, i * 3 + 1),
    ).flat();
    const r = solve(many, 7, 3);
    expect(r.status).toBe('budget_exhausted');
    expect(r.solution).toBeUndefined();
  });

  it('memoizes failed states so dead ends are not re-searched', () => {
    const seven = Array.from({ length: 7 }, (_, i) => tile(i + 1, i + 1));
    const r = solve(seven, 7, 100000);
    expect(r.nodes).toBeLessThan(2 ** 7 + 1);
  });

  it('gives a solution the real engine accepts and that stays in the tray limit', () => {
    const lvl: LevelDefinition = level([
      ...row(1, 3, 1, 0),
      ...row(2, 3, 4, 1),
      tile(7, 3, 0, 5, 0),
      tile(8, 3, 0.5, 5, 1),
      tile(9, 3, 6, 5, 0),
    ]);
    const r = solve(lvl.tiles, 7, 10000);
    expect(r.status).toBe('solvable');
    const engine = new GameEngine(lvl);
    let score = initialScoreState;
    for (const tileId of r.solution ?? []) {
      score = applyEvents(
        score,
        engine.dispatch({ type: 'SELECT_TILE', tileId }),
      );
    }
    expect(engine.getState().status).toBe('won');
    expect(score.peakTray).toBeLessThanOrEqual(6);
  });
});
