/**
 * Traceability suite: one describe per rule in GAME_DESIGN.md sections 3 to 5.
 * Names quote the rule so a failing test points straight at the design.
 */
import {
  GameEngine,
  LevelValidationError,
  MATCH_SIZE,
  TRAY_SIZE,
  evaluateCommandLog,
} from '@engine';
import type { Command, TileSpec } from '@engine';
import {
  CLEAR_BONUS_PER_UNUSED_SLOT,
  COMBO_BONUS_STEP,
  COMBO_MAX_LEVEL,
  MATCH_POINTS,
  TILE_SELECT_POINTS,
} from '@engine/scoring/constants';
import { level, row, tile } from '../helpers';

const select = (tileId: number): Command => ({ type: 'SELECT_TILE', tileId });
const play = (engine: GameEngine, ids: number[]) =>
  ids.forEach(id => engine.dispatch(select(id)));
const trayIds = (engine: GameEngine) => engine.getState().tray.map(t => t.id);
const boardIds = (engine: GameEngine) => engine.getState().board.map(t => t.id);

describe('Rule 1: every tile type appears in multiples of 3', () => {
  it.each([1, 2, 4, 5, 7])('rejects a type with %i tiles', count => {
    expect(() => new GameEngine(level(row(1, count, 1)))).toThrow(
      LevelValidationError,
    );
  });

  it.each([3, 6, 9])('accepts a type with %i tiles', count => {
    expect(() => new GameEngine(level(row(1, count, 1)))).not.toThrow();
  });

  it('checks each type on its own, not the total', () => {
    // 6 tiles in total, but 2 + 4 per type.
    const tiles = [...row(1, 2, 1), ...row(2, 4, 3)];
    expect(() => new GameEngine(level(tiles))).toThrow(/multiple of 3/);
  });
});

describe('Rule 2: a tile is free if no higher-layer tile overlaps it', () => {
  const free = (tiles: TileSpec[]) =>
    new GameEngine(level(tiles)).getFreeTileIds().sort((a, b) => a - b);
  const filler = row(9, 3, 50, 9); // keeps counts valid, far away

  it('is blocked by a higher tile that overlaps by less than one cell', () => {
    const tiles = [tile(1, 1, 0, 0, 0), tile(2, 1, 0.99, 0, 1)];
    expect(free([...tiles, tile(3, 1, 6, 6), ...filler])).not.toContain(1);
  });

  it('is not blocked by a tile exactly one cell away', () => {
    const tiles = [tile(1, 1, 0, 0, 0), tile(2, 1, 1, 0, 1)];
    expect(free([...tiles, tile(3, 1, 6, 6), ...filler])).toContain(1);
  });

  it('is not blocked by a tile on the same layer', () => {
    const tiles = [tile(1, 1, 0, 0, 1), tile(2, 1, 1, 0, 1)];
    expect(free([...tiles, tile(3, 1, 6, 6), ...filler])).toEqual(
      expect.arrayContaining([1, 2]),
    );
  });

  it('is not blocked by a tile on a lower layer', () => {
    const tiles = [tile(1, 1, 0, 0, 2), tile(2, 1, 0.5, 0, 0)];
    expect(free([...tiles, tile(3, 1, 6, 6), ...filler])).toContain(1);
  });

  it('is blocked by a tile two layers above', () => {
    const tiles = [tile(1, 1, 0, 0, 0), tile(2, 1, 0, 0, 2)];
    expect(free([...tiles, tile(3, 1, 6, 6), ...filler])).not.toContain(1);
  });

  it('only free tiles can be selected', () => {
    const engine = new GameEngine(
      level([tile(1, 1, 0, 0, 0), tile(2, 1, 0, 0, 1), tile(3, 1, 6, 6)]),
    );
    expect(engine.dispatch(select(1))).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'TILE_BLOCKED' },
    ]);
    expect(engine.dispatch(select(2))[0]?.type).toBe('TILE_SELECTED');
  });
});

describe('Rule 3: tapping a free tile moves it to the tray', () => {
  it('moves the tile off the board and into the tray', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    play(engine, [2]);
    expect(boardIds(engine)).toEqual([1, 3]);
    expect(trayIds(engine)).toEqual([2]);
  });

  it('has 7 slots and matches of 3', () => {
    expect(TRAY_SIZE).toBe(7);
    expect(MATCH_SIZE).toBe(3);
  });

  it('cannot select the same tile twice', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    play(engine, [1]);
    expect(engine.dispatch(select(1))).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'TILE_NOT_FOUND' },
    ]);
    expect(engine.getState().moves).toBe(1);
  });

  it('counts only accepted selections as moves', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    play(engine, [1, 99, 1, 2]);
    expect(engine.getState().moves).toBe(2);
  });
});

describe('Rule 4: tiles enter next to a same-type tile, else at the end', () => {
  it('slots a new tile beside its type even with other types after it', () => {
    const engine = new GameEngine(
      level([...row(1, 3, 1), ...row(2, 3, 4), ...row(3, 3, 7)]),
    );
    play(engine, [1, 4, 7, 2]); // A B C then another A
    expect(trayIds(engine)).toEqual([1, 2, 4, 7]);
  });

  it('appends a tile of a new type at the end', () => {
    const engine = new GameEngine(level([...row(1, 3, 1), ...row(2, 3, 4)]));
    play(engine, [1, 2, 4]);
    expect(trayIds(engine)).toEqual([1, 2, 4]);
  });

  it('keeps groups together across a whole game', () => {
    const engine = new GameEngine(
      level([...row(1, 3, 1), ...row(2, 3, 4), ...row(3, 3, 7)]),
    );
    play(engine, [1, 4, 2, 7, 5]);
    const types = engine.getState().tray.map(t => t.typeId);
    expect(types).toEqual([1, 1, 2, 2, 3]);
  });
});

describe('Rule 5: three identical tiles match and the rest shift left', () => {
  it('removes exactly the three matching tiles', () => {
    const engine = new GameEngine(level([...row(1, 3, 1), ...row(2, 3, 4)]));
    play(engine, [4, 1, 2, 3]);
    expect(trayIds(engine)).toEqual([4]);
  });

  it('shifts the remaining tiles left, keeping their order', () => {
    const engine = new GameEngine(
      level([...row(1, 3, 1), ...row(2, 3, 4), ...row(3, 3, 7)]),
    );
    play(engine, [4, 1, 7, 2, 3]); // tray: 4 | 1 2 3 (match) | 7
    expect(trayIds(engine)).toEqual([4, 7]);
  });

  it('does not match two tiles of a type', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    const events = [engine.dispatch(select(1)), engine.dispatch(select(2))];
    expect(events.flat().map(e => e.type)).toEqual([
      'TILE_SELECTED',
      'TILE_SELECTED',
    ]);
    expect(trayIds(engine)).toEqual([1, 2]);
  });

  it('reports the matched tiles in the event', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    play(engine, [1, 2]);
    expect(engine.dispatch(select(3))).toContainEqual({
      type: 'TILES_MATCHED',
      typeId: 1,
      tileIds: [1, 2, 3],
    });
  });
});

describe('Rule 6: removing a tile can free the tiles beneath it', () => {
  it('frees a tile once its only blocker is gone', () => {
    const engine = new GameEngine(
      level([tile(1, 1, 0, 0, 0), tile(2, 1, 0, 0, 1), tile(3, 1, 6, 6)]),
    );
    expect(engine.getFreeTileIds()).not.toContain(1);
    play(engine, [2]);
    expect(engine.getFreeTileIds()).toContain(1);
  });

  it('stays blocked until every blocker is gone', () => {
    const engine = new GameEngine(
      level([
        tile(1, 1, 0.5, 0, 0),
        tile(2, 1, 0, 0, 1),
        tile(3, 1, 1, 0, 1),
        ...row(2, 3, 20, 9),
      ]),
    );
    play(engine, [2]);
    expect(engine.getFreeTileIds()).not.toContain(1);
    play(engine, [3]);
    expect(engine.getFreeTileIds()).toContain(1);
  });
});

describe('Win / lose', () => {
  it('wins only when the board and the tray are both empty', () => {
    const engine = new GameEngine(level([...row(1, 3, 1), ...row(2, 3, 4)]));
    play(engine, [1, 2, 3]);
    expect(engine.getState().status).toBe('playing');
    play(engine, [4, 5, 6]);
    expect(engine.getState().status).toBe('won');
  });

  it('loses when the tray holds 7 tiles with no match', () => {
    const tiles = Array.from({ length: 7 }, (_, i) =>
      row(i + 1, 3, i * 3 + 1),
    ).flat();
    const engine = new GameEngine(level(tiles));
    play(engine, [1, 4, 7, 10, 13, 16]);
    expect(engine.getState().status).toBe('playing');
    play(engine, [19]);
    expect(engine.getState().status).toBe('lost');
    expect(engine.getState().tray).toHaveLength(7);
  });

  it('does not lose when the 7th tile completes a match', () => {
    const tiles = [
      ...row(1, 3, 1),
      ...row(2, 3, 4),
      ...row(3, 3, 7),
      ...row(4, 3, 10),
    ];
    const engine = new GameEngine(level(tiles));
    play(engine, [1, 2, 4, 5, 7, 8]);
    expect(engine.getState().tray).toHaveLength(6);
    play(engine, [3]);
    expect(engine.getState().status).toBe('playing');
  });

  it('accepts no commands after the game ends', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    play(engine, [1, 2, 3]);
    expect(engine.getState().status).toBe('won');
    expect(engine.dispatch(select(1))).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'GAME_NOT_ACTIVE' },
    ]);
  });
});

describe('Section 4: tile identity', () => {
  it('matches by typeId, not by id', () => {
    const engine = new GameEngine(
      level([tile(10, 5, 0), tile(20, 5, 1), tile(30, 5, 2)]),
    );
    play(engine, [10, 20]);
    const events = engine.dispatch(select(30));
    expect(events.map(e => e.type)).toContain('TILES_MATCHED');
  });

  it('keeps unique ids even for identical types', () => {
    expect(
      () =>
        new GameEngine(level([tile(1, 5, 0), tile(1, 5, 1), tile(2, 5, 2)])),
    ).toThrow(/Duplicate/);
  });
});

describe('Section 5: scoring table', () => {
  const evaluate = (tiles: TileSpec[], ids: number[]) =>
    evaluateCommandLog(level(tiles), ids.map(select), {
      twoStarScore: 1,
      threeStarScore: 2,
    }).score;

  it('uses the documented point values', () => {
    expect(TILE_SELECT_POINTS).toBe(10);
    expect(MATCH_POINTS).toBe(100);
    expect(COMBO_BONUS_STEP).toBe(50);
    expect(COMBO_MAX_LEVEL).toBe(5);
    expect(CLEAR_BONUS_PER_UNUSED_SLOT).toBe(50);
  });

  it('scores a single-match level as 3 x 10 + 100 + clear bonus', () => {
    const score = evaluate(row(1, 3, 1), [1, 2, 3]);
    expect(score.score).toBe(
      3 * TILE_SELECT_POINTS +
        MATCH_POINTS +
        (TRAY_SIZE - 3) * CLEAR_BONUS_PER_UNUSED_SLOT,
    );
  });

  it('does not add a clear bonus for a lost level', () => {
    const tiles = Array.from({ length: 7 }, (_, i) =>
      row(i + 1, 3, i * 3 + 1),
    ).flat();
    const score = evaluate(tiles, [1, 4, 7, 10, 13, 16, 19]);
    expect(score.score).toBe(7 * TILE_SELECT_POINTS);
    expect(score.completed).toBe(false);
  });
});
