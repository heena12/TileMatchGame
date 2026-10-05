import { GameEngine, findCollectSet } from '@engine';
import { tinyLevel } from '../testUtils';

describe('findCollectSet (the Wand)', () => {
  it('picks a free set of three', () => {
    const engine = new GameEngine(tinyLevel(1));
    expect(findCollectSet(engine.getState())).toEqual([1, 2, 3]);
  });

  it('prefers three from the board over finishing a set in the tray', () => {
    const engine = new GameEngine(tinyLevel(1));
    engine.dispatch({ type: 'SELECT_TILE', tileId: 1 });
    expect(findCollectSet(engine.getState())).toEqual([4, 5, 6]);
  });

  it('asks for only what is missing when nothing else is left', () => {
    const engine = new GameEngine(tinyLevel(1));
    [1, 4, 5].forEach(tileId =>
      engine.dispatch({ type: 'SELECT_TILE', tileId }),
    );
    expect(findCollectSet(engine.getState())).toEqual([2, 3]);
  });

  it('gives nothing once the game is over', () => {
    const engine = new GameEngine(tinyLevel(1));
    [1, 2, 3, 4, 5, 6].forEach(tileId =>
      engine.dispatch({ type: 'SELECT_TILE', tileId }),
    );
    expect(findCollectSet(engine.getState())).toBeNull();
  });

  it('never returns tiles that cannot be tapped', () => {
    const level = {
      ...tinyLevel(1),
      tiles: [
        { id: 1, typeId: 1, x: 0, y: 0, layer: 0 },
        { id: 2, typeId: 1, x: 0.5, y: 0, layer: 1 },
        { id: 3, typeId: 1, x: 5, y: 0, layer: 0 },
        { id: 4, typeId: 1, x: 6, y: 0, layer: 0 },
        { id: 5, typeId: 1, x: 7, y: 0, layer: 0 },
        { id: 6, typeId: 1, x: 3, y: 2, layer: 0 },
      ],
    };
    const engine = new GameEngine(level);
    const set = findCollectSet(engine.getState());
    // Tile 1 is covered by tile 2, so it is never part of the set.
    expect(set).toEqual([2, 3, 4]);
    expect(set).not.toContain(1);
  });

  it('plays out as a match', () => {
    const engine = new GameEngine(tinyLevel(1));
    const events = (findCollectSet(engine.getState()) ?? []).flatMap(tileId =>
      engine.dispatch({ type: 'SELECT_TILE', tileId }),
    );
    expect(events.some(e => e.type === 'TILES_MATCHED')).toBe(true);
  });
});
