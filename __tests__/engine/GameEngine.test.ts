import { GameEngine, TRAY_SIZE } from '@engine';
import type { Command } from '@engine';
import { level, row, tile } from './helpers';

const select = (tileId: number): Command => ({ type: 'SELECT_TILE', tileId });

describe('GameEngine', () => {
  it('starts playing with everything on the board', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    expect(engine.getState()).toMatchObject({
      status: 'playing',
      moves: 0,
      tray: [],
    });
    expect(engine.getState().board).toHaveLength(3);
  });

  it('moves a selected tile to the tray and emits TILE_SELECTED', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    const events = engine.dispatch(select(1));
    expect(events).toEqual([
      { type: 'TILE_SELECTED', tileId: 1, typeId: 1, trayIndex: 0 },
    ]);
    expect(engine.getState().tray.map(t => t.id)).toEqual([1]);
    expect(engine.getState().board.map(t => t.id)).toEqual([2, 3]);
  });

  it('matches three of a kind, removes them and wins on a cleared board', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    engine.dispatch(select(1));
    engine.dispatch(select(2));
    const events = engine.dispatch(select(3));
    expect(events.map(e => e.type)).toEqual([
      'TILE_SELECTED',
      'TILES_MATCHED',
      'LEVEL_COMPLETED',
    ]);
    expect(engine.getState()).toMatchObject({ status: 'won', tray: [] });
  });

  it('keeps playing after a match while tiles remain', () => {
    const engine = new GameEngine(level([...row(1, 3, 1), ...row(2, 3, 4)]));
    [1, 2, 3].forEach(id => engine.dispatch(select(id)));
    expect(engine.getState().status).toBe('playing');
    expect(engine.getState().tray).toEqual([]);
  });

  it('rejects a blocked tile and leaves state unchanged', () => {
    const engine = new GameEngine(
      level([tile(1, 1, 0, 0, 0), tile(2, 1, 0.5, 0, 1), tile(3, 1, 5, 0, 0)]),
    );
    const before = engine.getState();
    expect(engine.dispatch(select(1))).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'TILE_BLOCKED' },
    ]);
    expect(engine.getState()).toBe(before);
    expect(engine.getCommandLog()).toEqual([]);
  });

  it('frees the tile underneath once the top tile is removed', () => {
    const engine = new GameEngine(
      level([tile(1, 1, 0, 0, 0), tile(2, 1, 0.5, 0, 1), tile(3, 1, 5, 0, 0)]),
    );
    expect(engine.getFreeTileIds().sort()).toEqual([2, 3]);
    engine.dispatch(select(2));
    expect(engine.getFreeTileIds().sort()).toEqual([1, 3]);
  });

  it('rejects an unknown tile', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    expect(engine.dispatch(select(99))).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'TILE_NOT_FOUND' },
    ]);
  });

  it('loses when the tray fills with no match, then rejects further commands', () => {
    // 7 distinct types (3 tiles each) so no match can occur in the first 7 picks.
    const tiles = Array.from({ length: TRAY_SIZE }, (_, i) =>
      row(i + 1, 3, i * 3 + 1),
    ).flat();
    const engine = new GameEngine(level(tiles));
    // First tile of each type: ids 1, 4, 7, ...
    let events: readonly { type: string }[] = [];
    for (let i = 0; i < TRAY_SIZE; i++) {
      events = engine.dispatch(select(i * 3 + 1));
    }
    expect(engine.getState().status).toBe('lost');
    expect(events.map(e => e.type)).toEqual(['TILE_SELECTED', 'GAME_OVER']);
    expect(engine.dispatch(select(2))).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'GAME_NOT_ACTIVE' },
    ]);
  });

  it('a match on the 7th tile prevents a loss', () => {
    // Six singles fill 6 slots; the 7th pick completes a triple only if two are already grouped.
    const tiles = [
      ...row(1, 3, 1),
      ...row(2, 3, 4),
      ...row(3, 3, 7),
      ...row(4, 3, 10),
    ];
    const engine = new GameEngine(level(tiles));
    [1, 2, 4, 5, 7, 8].forEach(id => engine.dispatch(select(id)));
    expect(engine.getState().tray).toHaveLength(6);
    engine.dispatch(select(3));
    expect(engine.getState().status).toBe('playing');
    expect(engine.getState().tray).toHaveLength(4);
  });

  it('does not mutate a previously returned snapshot', () => {
    const engine = new GameEngine(level(row(1, 3, 1)));
    const before = engine.getState();
    engine.dispatch(select(1));
    expect(before.board).toHaveLength(3);
    expect(before.tray).toHaveLength(0);
    expect(before.moves).toBe(0);
  });

  it('is deterministic: replaying the command log reproduces the state', () => {
    const lvl = level([...row(1, 3, 1), ...row(2, 3, 4)]);
    const engine = new GameEngine(lvl);
    [1, 4, 2, 5, 99, 3, 6].forEach(id => engine.dispatch(select(id)));
    const replayed = GameEngine.replay(lvl, engine.getCommandLog());
    expect(replayed.getState()).toEqual(engine.getState());
    expect(engine.getCommandLog()).toHaveLength(6);
    expect(engine.getState().status).toBe('won');
  });
});
