/**
 * Random games that mix normal moves with Undo, Shuffle and Hint, checking
 * after every single operation that nothing the boosters do can break the
 * game's rules or its bookkeeping.
 */
import {
  GameEngine,
  SeededRandom,
  applyEvents,
  evaluateCommandLog,
  generateLevel,
  initialScoreState,
  solve,
} from '@engine';
import type { Command, GameState, LevelDefinition, ScoreState } from '@engine';

function checkState(state: GameState, allIds: readonly number[]) {
  const present = [...state.board, ...state.tray].map(t => t.id);
  expect(new Set(present).size).toBe(present.length);
  present.forEach(id => expect(allIds).toContain(id));

  // A match always removes exactly three, so what is left is a whole number of sets.
  const perType = new Map<number, number>();
  [...state.board, ...state.tray].forEach(t =>
    perType.set(t.typeId, (perType.get(t.typeId) ?? 0) + 1),
  );
  perType.forEach(count => expect(count % 3).toBe(0));
  expect((allIds.length - present.length) % 3).toBe(0);

  expect(state.tray.length).toBeLessThanOrEqual(7);
  if (state.status === 'playing') {
    expect(state.tray.length).toBeLessThanOrEqual(6);
  }
  const waiting = new Map<number, number>();
  state.tray.forEach(t =>
    waiting.set(t.typeId, (waiting.get(t.typeId) ?? 0) + 1),
  );
  waiting.forEach(c => expect(c).toBeLessThan(3));

  if (state.status === 'won') {
    expect(state.board).toHaveLength(0);
    expect(state.tray).toHaveLength(0);
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

interface Tally {
  games: number;
  undos: number;
  shuffles: number;
  hints: number;
  rejected: number;
  winnableShuffles: number;
  wins: number;
}

function playWithBoosters(lvl: LevelDefinition, seed: number, tally: Tally) {
  const rng = new SeededRandom(seed);
  const engine = new GameEngine(lvl);
  const allIds = lvl.tiles.map(t => t.id);
  let score: ScoreState = initialScoreState;
  tally.games++;

  for (let step = 0; step < allIds.length * 4; step++) {
    if (engine.getState().status !== 'playing') {
      break;
    }
    const before = deepFreeze(engine.getState());
    const roll = rng.next();
    let command: Command;
    if (roll < 0.14) {
      command = { type: 'UNDO' };
    } else if (roll < 0.2) {
      command = { type: 'SHUFFLE', seed: Math.floor(rng.next() * 1e9) };
    } else if (roll < 0.27) {
      command = { type: 'HINT' };
    } else if (roll < 0.32) {
      command = { type: 'SELECT_TILE', tileId: 9_000_000 + step };
    } else {
      const free = engine.getFreeTileIds();
      command = {
        type: 'SELECT_TILE',
        tileId: free[Math.floor(rng.next() * free.length)] as number,
      };
    }

    // Was the game still winnable just before a shuffle?
    let winnableBefore = false;
    if (command.type === 'SHUFFLE' && before.board.length <= 60) {
      const inTray = new Map<number, number>();
      before.tray.forEach(t =>
        inTray.set(t.typeId, (inTray.get(t.typeId) ?? 0) + 1),
      );
      winnableBefore =
        solve(before.board, 7, 200000, inTray).status === 'solvable';
    }

    const events = engine.dispatch(command);
    score = applyEvents(score, events);
    const after = engine.getState();
    const rejected = events.some(e => e.type === 'COMMAND_REJECTED');

    if (rejected) {
      tally.rejected++;
      expect(after).toBe(before);
    } else if (command.type === 'UNDO') {
      tally.undos++;
    } else if (command.type === 'SHUFFLE') {
      tally.shuffles++;
      expect(after.history).toHaveLength(0);
      expect(after.tray).toBe(before.tray);
      if (winnableBefore && after.status === 'playing') {
        const inTray = new Map<number, number>();
        after.tray.forEach(t =>
          inTray.set(t.typeId, (inTray.get(t.typeId) ?? 0) + 1),
        );
        expect(solve(after.board, 7, 300000, inTray).status).toBe('solvable');
        tally.winnableShuffles++;
      }
    } else if (command.type === 'HINT') {
      tally.hints++;
      expect(after).toBe(before);
    }

    checkState(after, allIds);

    // The engine's bookkeeping and the score's must stay in step.
    const log = engine.getCommandLog();
    const selects = log.filter(c => c.type === 'SELECT_TILE').length;
    const undos = log.filter(c => c.type === 'UNDO').length;
    expect(after.moves).toBe(selects - undos);
    expect(score.selections).toBe(after.moves);
  }

  // Everything can be reproduced from the log alone.
  const replayed = GameEngine.replay(lvl, engine.getCommandLog());
  expect(replayed.getState()).toEqual(engine.getState());
  const evaluation = evaluateCommandLog(lvl, engine.getCommandLog(), {
    twoStarScore: 1,
    threeStarScore: 2,
  });
  expect(evaluation.score).toEqual(score);
  expect(replayed.getBoostersUsed()).toBe(engine.getBoostersUsed());
  if (engine.getState().status === 'won') {
    tally.wins++;
  }
}

describe('random play with boosters', () => {
  const tally: Tally = {
    games: 0,
    undos: 0,
    shuffles: 0,
    hints: 0,
    rejected: 0,
    winnableShuffles: 0,
    wins: 0,
  };

  it.each([1, 3, 8, 12, 25, 60])(
    'keeps every invariant on generated level %i',
    id => {
      const lvl = generateLevel(id);
      for (let seed = 1; seed <= 5; seed++) {
        playWithBoosters(lvl, seed * 104729 + id, tally);
      }
    },
  );

  it('actually exercised every booster, rejections, shuffles that had to stay winnable, and wins', () => {
    expect(tally.games).toBe(30);
    expect(tally.undos).toBeGreaterThan(10);
    expect(tally.shuffles).toBeGreaterThan(10);
    expect(tally.hints).toBeGreaterThan(10);
    expect(tally.rejected).toBeGreaterThan(10);
    expect(tally.winnableShuffles).toBeGreaterThan(5);
    expect(tally.wins).toBeGreaterThan(0);
  });
});
