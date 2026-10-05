/**
 * Property tests: play many seeded random games and check the invariants that
 * must hold after every single command, whatever the player does.
 */
import {
  GameEngine,
  SeededRandom,
  applyEvents,
  evaluateCommandLog,
  generateLevel,
  initialScoreState,
} from '@engine';
import type { LevelDefinition, GameEvent, GameState } from '@engine';
import { level, row } from '../helpers';

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

function checkState(
  state: GameState,
  totalTiles: number,
  removedIds: ReadonlySet<number>,
) {
  const all = [...state.board, ...state.tray].map(t => t.id);
  // Tile conservation: nothing appears or vanishes.
  expect(all.length + removedIds.size).toBe(totalTiles);
  expect(new Set([...all, ...removedIds]).size).toBe(totalTiles);

  expect(state.tray.length).toBeLessThanOrEqual(7);
  if (state.status === 'playing') {
    expect(state.tray.length).toBeLessThanOrEqual(6);
  }

  // Never three of a kind waiting in the tray, and each type sits together.
  const counts = new Map<number, number>();
  state.tray.forEach(t =>
    counts.set(t.typeId, (counts.get(t.typeId) ?? 0) + 1),
  );
  counts.forEach(c => expect(c).toBeLessThan(3));
  const closed = new Set<number>();
  state.tray.forEach((t, i) => {
    const prev = state.tray[i - 1];
    if (prev && prev.typeId !== t.typeId) {
      closed.add(prev.typeId);
    }
    expect(closed.has(t.typeId)).toBe(false);
  });

  if (state.status === 'won') {
    expect(state.board).toHaveLength(0);
    expect(state.tray).toHaveLength(0);
  } else if (state.status === 'lost') {
    expect(state.tray.length).toBeGreaterThanOrEqual(7);
  } else {
    expect(state.board.length + state.tray.length).toBeGreaterThan(0);
  }
}

interface Outcome {
  status: string;
  accepted: number;
  rejected: number;
}

function playRandomGame(lvl: LevelDefinition, seed: number): Outcome {
  const rng = new SeededRandom(seed);
  const engine = new GameEngine(lvl);
  const total = lvl.tiles.length;
  const removed = new Set<number>();
  let score = initialScoreState;
  let accepted = 0;
  let rejected = 0;
  let previousScore = 0;

  for (let step = 0; step < total * 3; step++) {
    if (engine.getState().status !== 'playing') {
      break;
    }
    const before = deepFreeze(engine.getState());
    const free = engine.getFreeTileIds();
    const blocked = before.board
      .map(t => t.id)
      .filter(id => !free.includes(id));

    let command;
    let expectedReason: string | undefined;
    const roll = rng.next();
    if (roll < 0.08) {
      command = { type: 'SELECT_TILE' as const, tileId: 1_000_000 + step };
      expectedReason = 'TILE_NOT_FOUND';
    } else if (roll < 0.16 && blocked.length > 0) {
      command = {
        type: 'SELECT_TILE' as const,
        tileId: blocked[Math.floor(rng.next() * blocked.length)] as number,
      };
      expectedReason = 'TILE_BLOCKED';
    } else {
      command = {
        type: 'SELECT_TILE' as const,
        tileId: free[Math.floor(rng.next() * free.length)] as number,
      };
    }

    const events: readonly GameEvent[] = engine.dispatch(command);
    score = applyEvents(score, events);
    const after = engine.getState();

    if (expectedReason) {
      rejected++;
      expect(events).toEqual([
        { type: 'COMMAND_REJECTED', reason: expectedReason },
      ]);
      expect(after).toBe(before); // rejected commands do not touch state
    } else {
      accepted++;
      events.forEach(e => {
        if (e.type === 'TILES_MATCHED') {
          e.tileIds.forEach(id => removed.add(id));
        }
      });
      expect(after.moves).toBe(before.moves + 1);
    }

    checkState(after, total, removed);
    expect(score.score).toBeGreaterThanOrEqual(previousScore);
    previousScore = score.score;
  }

  const finalState = engine.getState();
  expect(finalState.status).not.toBe('playing'); // every game terminates
  expect(finalState.moves).toBe(accepted);
  expect(engine.getCommandLog()).toHaveLength(accepted);

  // Determinism: the log reproduces the state, and the score is recomputable.
  expect(GameEngine.replay(lvl, engine.getCommandLog()).getState()).toEqual(
    finalState,
  );
  const evaluation = evaluateCommandLog(lvl, engine.getCommandLog(), {
    twoStarScore: 1,
    threeStarScore: 2,
  });
  expect(evaluation.score).toEqual(score);
  expect(evaluation.won).toBe(finalState.status === 'won');

  // Once over, everything is rejected.
  expect(engine.dispatch({ type: 'SELECT_TILE', tileId: total + 1 })).toEqual([
    { type: 'COMMAND_REJECTED', reason: 'GAME_NOT_ACTIVE' },
  ]);

  return { status: finalState.status, accepted, rejected };
}

const GENERATED_IDS = [1, 2, 3, 5, 8, 10, 12, 20, 45, 80, 150, 400, 700, 1200];

describe('random play keeps every invariant', () => {
  const outcomes: Outcome[] = [];

  it.each(GENERATED_IDS)('generated level %i, several seeds', id => {
    const lvl = generateLevel(id);
    for (let seed = 1; seed <= 6; seed++) {
      outcomes.push(playRandomGame(lvl, seed * 7919 + id));
    }
  });

  it('handmade levels: a single triple and a wide single layer', () => {
    const single = level(row(1, 3, 1));
    const wide = level(
      Array.from({ length: 8 }, (_, i) => row(i + 1, 3, i * 3 + 1, i)).flat(),
    );
    for (let seed = 1; seed <= 25; seed++) {
      outcomes.push(playRandomGame(single, seed));
      outcomes.push(playRandomGame(wide, seed));
    }
  });

  it('exercised wins, losses and rejected commands', () => {
    expect(outcomes.length).toBeGreaterThan(100);
    expect(outcomes.some(o => o.status === 'won')).toBe(true);
    expect(outcomes.some(o => o.status === 'lost')).toBe(true);
    expect(outcomes.some(o => o.rejected > 0)).toBe(true);
  });
});

describe('a game always ends within a bounded number of moves', () => {
  it('needs at most one accepted move per tile', () => {
    const lvl = generateLevel(300);
    for (let seed = 1; seed <= 5; seed++) {
      const outcome = playRandomGame(lvl, seed);
      expect(outcome.accepted).toBeLessThanOrEqual(lvl.tiles.length);
    }
  });
});
