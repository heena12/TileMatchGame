import {
  GameEngine,
  REVIVE_UNDO,
  applyEvents,
  evaluateCommandLog,
  initialScoreState,
  isBoosterCommand,
  levelFingerprint,
  verifyRun,
} from '@engine';
import type { Command, GameEvent, RunClaim } from '@engine';
import { losingLevel } from '../testUtils';

const select = (tileId: number): Command => ({ type: 'SELECT_TILE', tileId });

/** Seven different pictures in a row: the tray fills and the game is lost. */
const LOSING_TAPS = [1, 4, 7, 10, 13, 16, 19];

/** From the revived game, clear every remaining set in turn. */
const FINISH = [
  2, 3, 5, 6, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24,
];

function lostEngine() {
  const engine = new GameEngine(losingLevel(1));
  const events: GameEvent[] = [];
  for (const id of LOSING_TAPS) {
    events.push(...engine.dispatch(select(id)));
  }
  return { engine, events };
}

describe('REVIVE', () => {
  it('puts a lost game back three selections earlier, playing again', () => {
    const { engine } = lostEngine();
    expect(engine.getState().status).toBe('lost');
    expect(engine.getState().tray).toHaveLength(7);

    const events = engine.dispatch({ type: 'REVIVE' });
    expect(events).toEqual([{ type: 'GAME_REVIVED', undone: REVIVE_UNDO }]);
    const state = engine.getState();
    expect(state.status).toBe('playing');
    expect(state.tray.map(t => t.id)).toEqual([1, 4, 7, 10]);
    expect(state.board).toHaveLength(24 - 4);
    expect(state.moves).toBe(4);
  });

  it('is refused unless the game is lost', () => {
    const engine = new GameEngine(losingLevel(1));
    expect(engine.dispatch({ type: 'REVIVE' })).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'GAME_NOT_ACTIVE' },
    ]);
    engine.dispatch(select(1));
    expect(engine.dispatch({ type: 'REVIVE' })[0]?.type).toBe(
      'COMMAND_REJECTED',
    );
  });

  it('can be used again if the game is lost a second time', () => {
    const { engine } = lostEngine();
    engine.dispatch({ type: 'REVIVE' });
    [13, 16, 19].forEach(id => engine.dispatch(select(id)));
    expect(engine.getState().status).toBe('lost');
    expect(engine.dispatch({ type: 'REVIVE' })[0]?.type).toBe('GAME_REVIVED');
    expect(engine.getState().status).toBe('playing');
  });

  it('counts as a booster, so it is visible to the "no boosters" star', () => {
    expect(isBoosterCommand({ type: 'REVIVE' })).toBe(true);
    const { engine } = lostEngine();
    engine.dispatch({ type: 'REVIVE' });
    expect(engine.getBoostersUsed()).toBe(1);
  });

  it('rolls the score back with the selections it takes back', () => {
    const engine = new GameEngine(losingLevel(1));
    let score = initialScoreState;
    let afterFour = initialScoreState;
    LOSING_TAPS.forEach((id, i) => {
      score = applyEvents(score, engine.dispatch(select(id)));
      if (i === 3) {
        afterFour = score;
      }
    });
    expect(score.score).toBeGreaterThan(afterFour.score);
    const revived = applyEvents(score, engine.dispatch({ type: 'REVIVE' }));
    expect(revived.score).toBe(afterFour.score);
    expect(revived.selections).toBe(afterFour.selections);
  });

  it('lets the player finish and win, and the whole run still verifies', () => {
    const level = losingLevel(1);
    const commands: Command[] = [
      ...LOSING_TAPS.map(select),
      { type: 'REVIVE' },
      ...FINISH.map(select),
    ];
    const { score, stars } = evaluateCommandLog(level, commands, {
      twoStarScore: level.twoStarScore,
      threeStarScore: level.threeStarScore,
    });
    const claim: RunClaim = {
      levelId: level.levelId,
      levelContentVersion: levelFingerprint(level),
      commands,
      score: score.score,
      stars,
    };
    const result = verifyRun(level, claim);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.boostersUsed).toBe(1);
    }
  });

  it('is refused by verification if it is not actually a lost game', () => {
    const level = losingLevel(1);
    const claim: RunClaim = {
      levelId: level.levelId,
      levelContentVersion: levelFingerprint(level),
      commands: [{ type: 'REVIVE' }],
      score: 0,
      stars: 1,
    };
    expect(verifyRun(level, claim)).toEqual({
      valid: false,
      reason: 'REJECTED_COMMAND',
    });
  });

  it('takes back only as many selections as exist', () => {
    // A level so tight that it is lost after the first taps: history is short.
    const { engine } = lostEngine();
    expect(engine.getState().history).toHaveLength(7);
    engine.dispatch({ type: 'REVIVE' });
    expect(engine.getState().history).toHaveLength(7 - REVIVE_UNDO);
  });
});
