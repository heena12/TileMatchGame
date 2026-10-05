import { GameEngine, evaluateCommandLog } from '@engine';
import type { Command } from '@engine';
import { defaultThresholds } from '@engine/scoring/StarSystem';
import { level, row } from '../helpers';

const lvl = level([...row(1, 3, 1), ...row(2, 3, 4)]);
const select = (tileId: number): Command => ({ type: 'SELECT_TILE', tileId });

describe('evaluateCommandLog', () => {
  it('recomputes score, win and stars from the command log', () => {
    const thresholds = defaultThresholds(6); // ref 260 -> 312 / 416
    const log = [1, 2, 3, 4, 5, 6].map(select);
    const result = evaluateCommandLog(lvl, log, thresholds);
    // 60 + 200 + 50 combo + clear bonus 200 (peak 3).
    expect(result.score.score).toBe(510);
    expect(result.won).toBe(true);
    expect(result.stars).toBe(3);
  });

  it('is deterministic and matches a live engine log', () => {
    const engine = new GameEngine(lvl);
    [1, 4, 99, 2, 5, 3, 6].map(select).forEach(c => engine.dispatch(c));
    const thresholds = defaultThresholds(6);
    const a = evaluateCommandLog(lvl, engine.getCommandLog(), thresholds);
    const b = evaluateCommandLog(lvl, engine.getCommandLog(), thresholds);
    expect(a).toEqual(b);
    expect(a.won).toBe(true);
  });

  it('gives 0 stars for an unfinished log', () => {
    const result = evaluateCommandLog(
      lvl,
      [1, 2].map(select),
      defaultThresholds(6),
    );
    expect(result.won).toBe(false);
    expect(result.stars).toBe(0);
  });

  it('counts boosters from the log itself for the no-boosters star rule', () => {
    const thresholds = { ...defaultThresholds(6), noBoosters: true };
    const plain = [1, 2, 3, 4, 5, 6].map(select);
    const withHint: Command[] = [{ type: 'HINT' }, ...plain];
    expect(evaluateCommandLog(lvl, plain, thresholds).stars).toBe(3);
    expect(evaluateCommandLog(lvl, withHint, thresholds).stars).toBe(2);
  });

  it('ignores boosters for stars when the level allows them', () => {
    const withHint: Command[] = [
      { type: 'HINT' },
      ...[1, 2, 3, 4, 5, 6].map(select),
    ];
    expect(evaluateCommandLog(lvl, withHint, defaultThresholds(6)).stars).toBe(
      3,
    );
  });

  it('a rejected booster is not counted', () => {
    const thresholds = { ...defaultThresholds(6), noBoosters: true };
    const log: Command[] = [
      { type: 'UNDO' },
      ...[1, 2, 3, 4, 5, 6].map(select),
    ];
    expect(evaluateCommandLog(lvl, log, thresholds).stars).toBe(3);
  });

  it('an undo puts the score back as if the selection never happened', () => {
    const log: Command[] = [select(1), select(2), { type: 'UNDO' }, select(2)];
    const undone = evaluateCommandLog(lvl, log, defaultThresholds(6)).score;
    const direct = evaluateCommandLog(
      lvl,
      [select(1), select(2)],
      defaultThresholds(6),
    ).score;
    expect(undone.score).toBe(direct.score);
    expect(undone.selections).toBe(direct.selections);
  });
});
