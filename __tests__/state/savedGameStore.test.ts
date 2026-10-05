import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import {
  SAVED_GAME_SCHEMA_VERSION,
  createSavedGameStore,
} from '@state/savedGameStore';
import type { SavedGame } from '@state/savedGameStore';

const KEY = 'game.inProgress';

const game = (levelId = 12, ids: number[] = [3, 5, 8]): SavedGame => ({
  levelId,
  levelContentVersion: 'abc12345',
  commands: ids.map(tileId => ({ type: 'SELECT_TILE' as const, tileId })),
});

describe('savedGameStore', () => {
  it('starts empty', () => {
    const store = createSavedGameStore(new InMemoryStorage());
    expect(store.getState().summary).toBeNull();
    expect(store.getState().read()).toBeNull();
  });

  it('saves a game and reports a summary', () => {
    const store = createSavedGameStore(new InMemoryStorage());
    store.getState().save(game());
    expect(store.getState().summary).toEqual({ levelId: 12, moves: 3 });
    expect(store.getState().read()).toEqual(game());
  });

  it('writes a versioned document', () => {
    const storage = new InMemoryStorage();
    createSavedGameStore(storage).getState().save(game());
    const doc = JSON.parse(storage.getString(KEY) as string);
    expect(doc.schemaVersion).toBe(SAVED_GAME_SCHEMA_VERSION);
    expect(doc.levelId).toBe(12);
    expect(doc.commands).toHaveLength(3);
  });

  it('a new save replaces the old one', () => {
    const store = createSavedGameStore(new InMemoryStorage());
    store.getState().save(game(12, [1, 2, 3]));
    store.getState().save(game(12, [1, 2, 3, 4]));
    expect(store.getState().summary?.moves).toBe(4);
    expect(store.getState().read()?.commands).toHaveLength(4);
  });

  it('clear removes it from storage and from the summary', () => {
    const storage = new InMemoryStorage();
    const store = createSavedGameStore(storage);
    store.getState().save(game());
    store.getState().clear();
    expect(store.getState().summary).toBeNull();
    expect(store.getState().read()).toBeNull();
    expect(storage.contains(KEY)).toBe(false);
  });

  it('clear with nothing saved is harmless', () => {
    const store = createSavedGameStore(new InMemoryStorage());
    expect(() => store.getState().clear()).not.toThrow();
  });

  it('survives an app restart', () => {
    const storage = new InMemoryStorage();
    createSavedGameStore(storage)
      .getState()
      .save(game(7, [9, 8]));
    const restored = createSavedGameStore(storage);
    expect(restored.getState().summary).toEqual({ levelId: 7, moves: 2 });
    expect(restored.getState().read()).toEqual(game(7, [9, 8]));
  });

  it('notifies subscribers when saved or cleared', () => {
    const store = createSavedGameStore(new InMemoryStorage());
    const seen: (number | null)[] = [];
    store.subscribe(s => seen.push(s.summary?.moves ?? null));
    store.getState().save(game(1, [1]));
    store.getState().save(game(1, [1, 2]));
    store.getState().clear();
    expect(seen).toEqual([1, 2, null]);
  });

  describe('unusable documents count as no saved game', () => {
    const cases: [string, string][] = [
      ['broken JSON', '{oops'],
      ['a newer version', JSON.stringify({ schemaVersion: 9, ...game() })],
      ['no version', JSON.stringify(game())],
      [
        'a missing level id',
        JSON.stringify({
          schemaVersion: 1,
          levelContentVersion: 'a',
          commands: [],
        }),
      ],
      ['a zero level id', JSON.stringify({ schemaVersion: 1, ...game(0) })],
      [
        'a fractional level id',
        JSON.stringify({ schemaVersion: 1, ...game(1.5) }),
      ],
      [
        'no content version',
        JSON.stringify({ schemaVersion: 1, levelId: 1, commands: [] }),
      ],
      [
        'an empty content version',
        JSON.stringify({
          schemaVersion: 1,
          levelId: 1,
          levelContentVersion: '',
          commands: [],
        }),
      ],
      [
        'commands that are not a list',
        JSON.stringify({
          schemaVersion: 1,
          levelId: 1,
          levelContentVersion: 'a',
          commands: 'x',
        }),
      ],
      [
        'an unknown command',
        JSON.stringify({
          schemaVersion: 1,
          levelId: 1,
          levelContentVersion: 'a',
          commands: [{ type: 'TELEPORT' }],
        }),
      ],
      [
        'a shuffle without a seed',
        JSON.stringify({
          schemaVersion: 1,
          levelId: 1,
          levelContentVersion: 'a',
          commands: [{ type: 'SHUFFLE' }],
        }),
      ],
      [
        'a shuffle with a fractional seed',
        JSON.stringify({
          schemaVersion: 1,
          levelId: 1,
          levelContentVersion: 'a',
          commands: [{ type: 'SHUFFLE', seed: 1.5 }],
        }),
      ],
      [
        'a command without a tile',
        JSON.stringify({
          schemaVersion: 1,
          levelId: 1,
          levelContentVersion: 'a',
          commands: [{ type: 'SELECT_TILE' }],
        }),
      ],
      [
        'a fractional tile id',
        JSON.stringify({
          schemaVersion: 1,
          levelId: 1,
          levelContentVersion: 'a',
          commands: [{ type: 'SELECT_TILE', tileId: 2.5 }],
        }),
      ],
      [
        'a null command',
        JSON.stringify({
          schemaVersion: 1,
          levelId: 1,
          levelContentVersion: 'a',
          commands: [null],
        }),
      ],
    ];

    it.each(cases)('%s', (_name, raw) => {
      const storage = new InMemoryStorage();
      storage.setString(KEY, raw);
      const store = createSavedGameStore(storage);
      expect(store.getState().summary).toBeNull();
      expect(store.getState().read()).toBeNull();
    });

    it('is overwritten cleanly by the next save', () => {
      const storage = new InMemoryStorage();
      storage.setString(KEY, '{oops');
      const store = createSavedGameStore(storage);
      store.getState().save(game());
      expect(store.getState().read()).toEqual(game());
    });
  });

  it('accepts an empty command list (a level opened but not yet played)', () => {
    const store = createSavedGameStore(new InMemoryStorage());
    store.getState().save(game(4, []));
    expect(store.getState().summary).toEqual({ levelId: 4, moves: 0 });
  });
});

describe('savedGameStore with booster commands', () => {
  const KEY2 = 'game.inProgress';

  it('stores and reads back undo, shuffle and hint in order', () => {
    const storage = new InMemoryStorage();
    const store = createSavedGameStore(storage);
    const commands = [
      { type: 'SELECT_TILE' as const, tileId: 4 },
      { type: 'HINT' as const },
      { type: 'SHUFFLE' as const, seed: 123456 },
      { type: 'SELECT_TILE' as const, tileId: 9 },
      { type: 'UNDO' as const },
    ];
    store
      .getState()
      .save({ levelId: 8, levelContentVersion: 'abc12345', commands });
    expect(createSavedGameStore(storage).getState().read()?.commands).toEqual(
      commands,
    );
    expect(createSavedGameStore(storage).getState().summary).toEqual({
      levelId: 8,
      moves: 5,
    });
  });

  it('drops fields it does not know from a stored command', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      KEY2,
      JSON.stringify({
        schemaVersion: 1,
        levelId: 2,
        levelContentVersion: 'a',
        commands: [
          { type: 'UNDO', extra: 'x' },
          { type: 'SHUFFLE', seed: 7, extra: 1 },
        ],
      }),
    );
    expect(createSavedGameStore(storage).getState().read()?.commands).toEqual([
      { type: 'UNDO' },
      { type: 'SHUFFLE', seed: 7 },
    ]);
  });
});
