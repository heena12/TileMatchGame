import { GameEngine, findHint, generateLevel, solve } from '@engine';
import type { Command, GameState, LevelDefinition } from '@engine';
import { level, row, tile } from './helpers';

const select = (tileId: number): Command => ({ type: 'SELECT_TILE', tileId });
const play = (engine: GameEngine, ids: number[]) =>
  ids.forEach(id => engine.dispatch(select(id)));
const trayIds = (e: GameEngine) => e.getState().tray.map(t => t.id);
const boardIds = (e: GameEngine) => e.getState().board.map(t => t.id);
const typesOf = (tiles: readonly { typeId: number }[]) =>
  tiles.map(t => t.typeId).sort((a, b) => a - b);

/** Two types of three in a row, so ids 1-3 are type 1 and 4-6 are type 2. */
const twoTypes = () => level([...row(1, 3, 1), ...row(2, 3, 4)]);

describe('Undo', () => {
  it('takes back the last selection', () => {
    const engine = new GameEngine(twoTypes());
    play(engine, [1, 4]);
    const events = engine.dispatch({ type: 'UNDO' });
    expect(events).toEqual([
      { type: 'SELECTION_UNDONE', tileId: 4, typeId: 2 },
    ]);
    expect(trayIds(engine)).toEqual([1]);
    expect(boardIds(engine)).toEqual([2, 3, 4, 5, 6]);
    expect(engine.getState().moves).toBe(1);
  });

  it('puts the game back exactly as it was, however many times it is used', () => {
    const engine = new GameEngine(twoTypes());
    const start = engine.getState();
    play(engine, [1, 4, 2]);
    engine.dispatch({ type: 'UNDO' });
    engine.dispatch({ type: 'UNDO' });
    engine.dispatch({ type: 'UNDO' });
    expect(engine.getState()).toEqual(start);
  });

  it('also undoes the match a selection caused', () => {
    const engine = new GameEngine(twoTypes());
    play(engine, [1, 2, 4]);
    expect(trayIds(engine)).toEqual([1, 2, 4]);
    play(engine, [3]); // completes the set of picture 1
    expect(trayIds(engine)).toEqual([4]);
    engine.dispatch({ type: 'UNDO' });
    // The match un-happens: tile 3 is back on the board, 1 and 2 are back in the tray.
    expect(trayIds(engine)).toEqual([1, 2, 4]);
    expect(boardIds(engine)).toEqual([3, 5, 6]);
  });

  it('makes the tile selectable again, and lets a different one be taken', () => {
    const engine = new GameEngine(twoTypes());
    play(engine, [1]);
    engine.dispatch({ type: 'UNDO' });
    expect(engine.getFreeTileIds()).toContain(1);
    const events = engine.dispatch(select(5));
    expect(events[0]?.type).toBe('TILE_SELECTED');
  });

  it('covers tiles again when the tile that freed them comes back', () => {
    const engine = new GameEngine(
      level([tile(1, 1, 0, 0, 0), tile(2, 1, 0.5, 0, 1), tile(3, 1, 5, 0, 0)]),
    );
    expect(engine.getFreeTileIds()).not.toContain(1);
    play(engine, [2]);
    expect(engine.getFreeTileIds()).toContain(1);
    engine.dispatch({ type: 'UNDO' });
    expect(engine.getFreeTileIds()).not.toContain(1);
  });

  it('is rejected, and not logged, when there is nothing to undo', () => {
    const engine = new GameEngine(twoTypes());
    const before = engine.getState();
    expect(engine.dispatch({ type: 'UNDO' })).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'NOTHING_TO_UNDO' },
    ]);
    expect(engine.getState()).toBe(before);
    expect(engine.getCommandLog()).toEqual([]);
  });

  it('is rejected once the game is won or lost', () => {
    const won = new GameEngine(level(row(1, 3, 1)));
    play(won, [1, 2, 3]);
    expect(won.dispatch({ type: 'UNDO' })).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'GAME_NOT_ACTIVE' },
    ]);

    const many = Array.from({ length: 7 }, (_, i) =>
      row(i + 1, 3, i * 3 + 1),
    ).flat();
    const lost = new GameEngine(level(many));
    play(lost, [1, 4, 7, 10, 13, 16, 19]);
    expect(lost.getState().status).toBe('lost');
    expect(lost.dispatch({ type: 'UNDO' })[0]).toEqual({
      type: 'COMMAND_REJECTED',
      reason: 'GAME_NOT_ACTIVE',
    });
  });

  it('canUndo follows the history', () => {
    const engine = new GameEngine(twoTypes());
    expect(engine.canUndo()).toBe(false);
    play(engine, [1]);
    expect(engine.canUndo()).toBe(true);
    engine.dispatch({ type: 'UNDO' });
    expect(engine.canUndo()).toBe(false);
  });

  it('does not change a snapshot that was handed out earlier', () => {
    const engine = new GameEngine(twoTypes());
    play(engine, [1, 2]);
    const snapshot = engine.getState();
    engine.dispatch({ type: 'UNDO' });
    expect(snapshot.tray.map(t => t.id)).toEqual([1, 2]);
    expect(snapshot.history).toHaveLength(2);
  });

  it('cannot go back past a shuffle', () => {
    const engine = new GameEngine(twoTypes());
    play(engine, [1]);
    engine.dispatch({ type: 'SHUFFLE', seed: 3 });
    expect(engine.canUndo()).toBe(false);
    expect(engine.dispatch({ type: 'UNDO' })[0]).toEqual({
      type: 'COMMAND_REJECTED',
      reason: 'NOTHING_TO_UNDO',
    });
    play(engine, [5]);
    expect(engine.canUndo()).toBe(true);
  });
});

describe('Shuffle', () => {
  const big = (): LevelDefinition => generateLevel(120);

  it('keeps every position, layer and id and the number of tiles of each picture', () => {
    const engine = new GameEngine(big());
    const before = engine.getState().board;
    const events = engine.dispatch({ type: 'SHUFFLE', seed: 42 });
    const after = engine.getState().board;
    expect(events).toEqual([{ type: 'BOARD_SHUFFLED' }]);
    expect(after).toHaveLength(before.length);
    after.forEach((t, i) => {
      const old = before[i]!;
      expect([t.id, t.x, t.y, t.layer]).toEqual([
        old.id,
        old.x,
        old.y,
        old.layer,
      ]);
    });
    expect(typesOf(after)).toEqual(typesOf(before));
  });

  it('actually changes which picture is where', () => {
    const engine = new GameEngine(big());
    const before = engine.getState().board.map(t => t.typeId);
    engine.dispatch({ type: 'SHUFFLE', seed: 42 });
    expect(engine.getState().board.map(t => t.typeId)).not.toEqual(before);
  });

  it('leaves the tray, moves and score-relevant state alone', () => {
    const engine = new GameEngine(big());
    play(engine, engine.getFreeTileIds().slice(0, 3));
    const { tray, moves } = engine.getState();
    engine.dispatch({ type: 'SHUFFLE', seed: 9 });
    expect(engine.getState().tray).toBe(tray);
    expect(engine.getState().moves).toBe(moves);
    expect(engine.getState().status).toBe('playing');
  });

  it('gives the same result for the same seed and different results for different seeds', () => {
    const run = (seed: number) => {
      const e = new GameEngine(big());
      e.dispatch({ type: 'SHUFFLE', seed });
      return e.getState().board.map(t => t.typeId);
    };
    expect(run(5)).toEqual(run(5));
    expect(run(5)).not.toEqual(run(6));
  });

  it('is written into the log with its seed, so a replay gives the same board', () => {
    const engine = new GameEngine(big());
    play(engine, engine.getFreeTileIds().slice(0, 2));
    engine.dispatch({ type: 'SHUFFLE', seed: 1234 });
    const free = engine.getFreeTileIds();
    play(engine, free.slice(0, 2));
    expect(engine.getCommandLog()).toContainEqual({
      type: 'SHUFFLE',
      seed: 1234,
    });
    const replayed = GameEngine.replay(big(), engine.getCommandLog());
    expect(replayed.getState()).toEqual(engine.getState());
  });

  it('is rejected when only one picture is left', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    const before = engine.getState();
    expect(engine.dispatch({ type: 'SHUFFLE', seed: 1 })).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'NOTHING_TO_SHUFFLE' },
    ]);
    expect(engine.getState()).toBe(before);
    expect(engine.canShuffle()).toBe(false);
  });

  it('is rejected once the game is over', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    play(engine, [1, 2, 3]);
    expect(engine.dispatch({ type: 'SHUFFLE', seed: 1 })[0]).toEqual({
      type: 'COMMAND_REJECTED',
      reason: 'GAME_NOT_ACTIVE',
    });
    expect(engine.canShuffle()).toBe(false);
  });

  it('canShuffle is true while at least two pictures remain', () => {
    const engine = new GameEngine(twoTypes());
    expect(engine.canShuffle()).toBe(true);
    play(engine, [1, 2, 3]);
    expect(engine.canShuffle()).toBe(false);
  });

  it('never makes a winnable game unwinnable, including with tiles in the tray', () => {
    let checked = 0;
    for (const id of [40, 120, 400, 900]) {
      for (let seed = 1; seed <= 6; seed++) {
        const engine = new GameEngine(generateLevel(id));
        // Play a few tiles so the tray is not empty.
        for (let k = 0; k < 2 + (seed % 3); k++) {
          const hint = engine.getHint();
          if (hint !== null) {
            engine.dispatch(select(hint));
          }
        }
        engine.dispatch({ type: 'SHUFFLE', seed: seed * 977 + id });
        const state = engine.getState();
        if (state.status !== 'playing') {
          continue;
        }
        const inTray = new Map<number, number>();
        state.tray.forEach(t =>
          inTray.set(t.typeId, (inTray.get(t.typeId) ?? 0) + 1),
        );
        expect(solve(state.board, 7, 300000, inTray).status).toBe('solvable');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(15);
  });

  it('falls back to a plain shuffle when the tray is too full for a winning deal', () => {
    // Six different pictures in the tray leave no room to finish any of them.
    const tiles = [
      ...Array.from({ length: 6 }, (_, i) =>
        row(i + 1, 3, i * 3 + 1, i),
      ).flat(),
      ...row(7, 3, 19, 6),
      ...row(8, 3, 22, 7),
    ];
    const engine = new GameEngine(level(tiles));
    play(engine, [1, 4, 7, 10, 13, 16]);
    expect(engine.getState().tray).toHaveLength(6);
    const before = typesOf(engine.getState().board);
    const events = engine.dispatch({ type: 'SHUFFLE', seed: 8 });
    expect(events).toEqual([{ type: 'BOARD_SHUFFLED' }]);
    expect(typesOf(engine.getState().board)).toEqual(before);
    expect(engine.getState().status).toBe('playing');
  });
});

describe('Hint', () => {
  it('suggests the tile that completes a set waiting in the tray', () => {
    const engine = new GameEngine(twoTypes());
    play(engine, [1, 2]);
    expect(engine.getHint()).toBe(3);
  });

  it('suggests a free tile', () => {
    const engine = new GameEngine(generateLevel(300));
    expect(engine.getFreeTileIds()).toContain(engine.getHint());
  });

  it('is null once the game is over', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    play(engine, [1, 2, 3]);
    expect(engine.getHint()).toBeNull();
    expect(findHint(engine.getState())).toBeNull();
  });

  it('reading a hint changes nothing and is not logged', () => {
    const engine = new GameEngine(twoTypes());
    const before = engine.getState();
    engine.getHint();
    expect(engine.getState()).toBe(before);
    expect(engine.getCommandLog()).toEqual([]);
    expect(engine.getBoostersUsed()).toBe(0);
  });

  it('the HINT command changes nothing but is logged and counts as a booster', () => {
    const engine = new GameEngine(twoTypes());
    const before = engine.getState();
    expect(engine.dispatch({ type: 'HINT' })).toEqual([{ type: 'HINT_USED' }]);
    expect(engine.getState()).toBe(before);
    expect(engine.getCommandLog()).toEqual([{ type: 'HINT' }]);
    expect(engine.getBoostersUsed()).toBe(1);
  });

  it('the HINT command is rejected after the game ends', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    play(engine, [1, 2, 3]);
    expect(engine.dispatch({ type: 'HINT' })[0]).toEqual({
      type: 'COMMAND_REJECTED',
      reason: 'GAME_NOT_ACTIVE',
    });
    expect(engine.getBoostersUsed()).toBe(0);
  });

  it('following hints all the way wins', () => {
    for (const id of [1, 20, 60, 200, 1000, 3000]) {
      const engine = new GameEngine(generateLevel(id));
      for (
        let step = 0;
        step < 200 && engine.getState().status === 'playing';
        step++
      ) {
        const hint = engine.getHint();
        expect(hint).not.toBeNull();
        engine.dispatch(select(hint as number));
      }
      expect(engine.getState().status).toBe('won');
    }
  });

  it('falls back to a sensible tile when no winning line exists', () => {
    // Six different pictures waiting: any further new picture loses.
    // Two more of picture 1 are free, so joining it is the natural choice.
    const tiles = [
      ...Array.from({ length: 6 }, (_, i) =>
        row(i + 1, 3, i * 3 + 1, i),
      ).flat(),
      ...row(7, 3, 19, 6),
    ];
    const engine = new GameEngine(level(tiles));
    play(engine, [1, 4, 7, 10, 13, 16]);
    const state: GameState = engine.getState();
    expect(
      solve(state.board, 7, 100000, new Map(state.tray.map(t => [t.typeId, 1])))
        .status,
    ).toBe('unsolvable');
    const hint = engine.getHint();
    expect(engine.getFreeTileIds()).toContain(hint);
    // Tile 2 (picture 1) joins a tile already in the tray.
    const chosen = state.board.find(t => t.id === hint)!;
    expect(state.tray.some(t => t.typeId === chosen.typeId)).toBe(true);
  });
});

describe('boosters and the command log', () => {
  it('counts only boosters that were accepted', () => {
    const engine = new GameEngine(twoTypes());
    engine.dispatch({ type: 'UNDO' }); // nothing to undo: rejected
    play(engine, [1]);
    engine.dispatch({ type: 'HINT' });
    engine.dispatch({ type: 'UNDO' });
    engine.dispatch({ type: 'SHUFFLE', seed: 1 });
    expect(engine.getBoostersUsed()).toBe(3);
  });

  it('replaying a log with boosters in it reproduces the state', () => {
    const lvl = generateLevel(90);
    const engine = new GameEngine(lvl);
    play(engine, engine.getFreeTileIds().slice(0, 2));
    engine.dispatch({ type: 'HINT' });
    engine.dispatch({ type: 'UNDO' });
    engine.dispatch({ type: 'SHUFFLE', seed: 77 });
    play(engine, engine.getFreeTileIds().slice(0, 3));
    const replayed = GameEngine.replay(lvl, engine.getCommandLog());
    expect(replayed.getState()).toEqual(engine.getState());
    expect(replayed.getBoostersUsed()).toBe(3);
  });
});
