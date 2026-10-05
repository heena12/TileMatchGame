import { GameEngine } from '@engine';
import type { GameEvent, LevelDefinition } from '@engine';
import {
  applyEvents,
  calculateClearBonus,
  currentComboLevel,
  initialScoreState,
} from '@engine/scoring/ScoreSystem';
import type { ScoreState } from '@engine/scoring/ScoreSystem';
import { level, row } from '../helpers';

/** Plays the picks on a real engine and folds every step's events into the score. */
function play(lvl: LevelDefinition, picks: number[]) {
  const engine = new GameEngine(lvl);
  let score: ScoreState = initialScoreState;
  const combos: number[] = [];
  for (const tileId of picks) {
    score = applyEvents(
      score,
      engine.dispatch({ type: 'SELECT_TILE', tileId }),
    );
    combos.push(currentComboLevel(score));
  }
  return { engine, score, combos };
}

// Types 1, 2, 3 with ids 1-3, 4-6, 7-9.
const threeTypes = level([...row(1, 3, 1), ...row(2, 3, 4), ...row(3, 3, 7)]);

describe('ScoreSystem base scoring', () => {
  it('starts at zero', () => {
    expect(initialScoreState.score).toBe(0);
  });

  it('awards 10 per selected tile', () => {
    const { score } = play(threeTypes, [1]);
    expect(score.score).toBe(10);
    expect(score.selections).toBe(1);
    expect(score.trayOccupancy).toBe(1);
  });

  it('awards 100 for a match on top of the selection points', () => {
    const { score } = play(threeTypes, [1, 2, 3]);
    expect(score.score).toBe(3 * 10 + 100);
    expect(score.matches).toBe(1);
    expect(score.trayOccupancy).toBe(0);
    expect(score.completed).toBe(false);
  });

  it('ignores rejected commands', () => {
    const { score } = play(threeTypes, [99]);
    expect(score).toEqual(initialScoreState);
  });

  it('ignores events it does not score', () => {
    const events: GameEvent[] = [
      { type: 'GAME_OVER', levelId: 1 },
      { type: 'COMMAND_REJECTED', reason: 'TILE_BLOCKED' },
    ];
    expect(applyEvents(initialScoreState, events)).toEqual(initialScoreState);
  });

  it('does not mutate the previous state', () => {
    const before = initialScoreState;
    play(threeTypes, [1, 2, 3]);
    expect(before.score).toBe(0);
  });
});

describe('ScoreSystem combos', () => {
  it('adds the combo bonus when matches chain', () => {
    // Match at selection 3, next match at selection 6 (3 later): level 1, +50.
    const { score, combos } = play(threeTypes, [1, 2, 3, 4, 5, 6]);
    expect(score.comboBonusTotal).toBe(50);
    expect(score.score).toBe(6 * 10 + 2 * 100 + 50);
    expect(combos[5]).toBe(1);
  });

  it('chains at exactly 3 selections even with misses in between', () => {
    // Match@4, misses @5 @6, match@7 (diff 3) chains, then match@9 chains again.
    const { score, combos } = play(threeTypes, [4, 1, 2, 3, 7, 5, 6, 8, 9]);
    expect(combos).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 2]);
    expect(score.comboBonusTotal).toBe(50 + 100);
  });

  it('resets after 3 selections with no match', () => {
    const four = level(
      Array.from({ length: 4 }, (_, i) => row(i + 1, 3, i * 3 + 1)).flat(),
    );
    // Matches @3 and @6 (level 1). Misses @7 @8 @9 reset the combo, so the
    // match @10 is level 0 and adds no bonus.
    const { score, combos } = play(four, [1, 2, 3, 4, 5, 6, 7, 10, 8, 9]);
    expect(combos).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 0, 0]);
    expect(score.comboBonusTotal).toBe(50);
  });

  it('caps the bonus at level 5 (250) over a long chain', () => {
    const eight = level(
      Array.from({ length: 8 }, (_, i) => row(i + 1, 3, i * 3 + 1)).flat(),
    );
    const picks = Array.from({ length: 24 }, (_, i) => i + 1);
    const { score, engine } = play(eight, picks);
    // Levels 0,1,2,3,4,5,5,5 -> 0+50+100+150+200+250+250+250.
    expect(score.comboBonusTotal).toBe(1250);
    expect(engine.getState().status).toBe('won');
  });
});

describe('ScoreSystem clear bonus', () => {
  it('computes 50 per slot unused at the peak', () => {
    expect(calculateClearBonus(0)).toBe(350);
    expect(calculateClearBonus(3)).toBe(200);
    expect(calculateClearBonus(7)).toBe(0);
    expect(calculateClearBonus(9)).toBe(0);
  });

  it('adds the clear bonus when the level completes', () => {
    const { score } = play(threeTypes, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // 9 selections, 3 matches, combo +50 +100, peak tray 3 -> bonus 200.
    expect(score.completed).toBe(true);
    expect(score.peakTray).toBe(3);
    expect(score.clearBonus).toBe(200);
    expect(score.score).toBe(90 + 300 + 150 + 200);
  });

  it('tracks the peak before a match removes tiles', () => {
    const { score } = play(threeTypes, [4, 1, 2, 3]);
    expect(score.peakTray).toBe(4);
  });

  it('gives no clear bonus on a loss', () => {
    const seven = level(
      Array.from({ length: 7 }, (_, i) => row(i + 1, 3, i * 3 + 1)).flat(),
    );
    const { score, engine } = play(seven, [1, 4, 7, 10, 13, 16, 19]);
    expect(engine.getState().status).toBe('lost');
    expect(score.completed).toBe(false);
    expect(score.clearBonus).toBe(0);
    expect(score.score).toBe(70);
  });
});

describe('ScoreSystem with Undo and Shuffle', () => {
  const run = (picks: (number | 'undo')[]) => {
    const engine = new GameEngine(threeTypes);
    let score: ScoreState = initialScoreState;
    for (const pick of picks) {
      const events =
        pick === 'undo'
          ? engine.dispatch({ type: 'UNDO' })
          : engine.dispatch({ type: 'SELECT_TILE', tileId: pick });
      score = applyEvents(score, events);
    }
    return { engine, score };
  };

  it('an undone selection leaves the score exactly as it was before it', () => {
    const withUndo = run([1, 2, 'undo']).score;
    const direct = run([1]).score;
    expect(withUndo).toEqual(direct);
  });

  it('takes back points, tray use and the peak', () => {
    const { score } = run([1, 4, 7, 'undo', 'undo', 'undo']);
    expect(score).toEqual(initialScoreState);
    expect(score.peakTray).toBe(0);
  });

  it('takes back a match and its points', () => {
    const { score } = run([1, 2, 3, 'undo']);
    expect(score.matches).toBe(0);
    expect(score.score).toBe(20);
    expect(score.trayOccupancy).toBe(2);
  });

  it('restores the combo, so re-doing the move earns the same bonus', () => {
    // Match @3, then 4 and 5, undo 5, and 5 again: nothing changes.
    const a = run([1, 2, 3, 4, 5, 6]).score;
    const b = run([1, 2, 3, 4, 5, 'undo', 5, 6]).score;
    expect(b).toEqual(a);
    expect(b.comboBonusTotal).toBe(50);
  });

  it('undoing the selection that ended a combo window brings the combo back', () => {
    const before = run([1, 2, 3, 4, 7]).score; // two misses after the match
    const undone = run([1, 2, 3, 4, 7, 5, 'undo']).score;
    expect(undone.combo).toEqual(before.combo);
  });

  it('an unusable undo changes nothing', () => {
    const { score } = run(['undo']);
    expect(score).toEqual(initialScoreState);
  });

  it('a shuffle forgets what could be undone but keeps the score', () => {
    const engine = new GameEngine(threeTypes);
    let score: ScoreState = initialScoreState;
    for (const tileId of [1, 4]) {
      score = applyEvents(
        score,
        engine.dispatch({ type: 'SELECT_TILE', tileId }),
      );
    }
    const shuffled = applyEvents(
      score,
      engine.dispatch({ type: 'SHUFFLE', seed: 1 }),
    );
    expect(shuffled.score).toBe(score.score);
    expect(shuffled.selections).toBe(2);
    expect(shuffled.previous).toBeNull();
    expect(engine.canUndo()).toBe(false);
  });

  it('a hint does not touch the score', () => {
    const { score } = run([1]);
    const engine = new GameEngine(threeTypes);
    const hinted = applyEvents(score, engine.dispatch({ type: 'HINT' }));
    expect(hinted).toBe(score);
  });

  it('new selections after an undo can be undone in turn', () => {
    const { score } = run([1, 2, 'undo', 4, 'undo', 'undo']);
    expect(score).toEqual(initialScoreState);
  });
});
