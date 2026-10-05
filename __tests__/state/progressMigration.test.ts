import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import {
  PROGRESS_SCHEMA_VERSION,
  createProgressStore,
} from '@state/progressStore';

const clock = (start = 500) => {
  let now = start;
  return { now: () => now++ };
};

const KEY = 'player.progress';
const BACKUP = 'player.progress.backup';

const v1 = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    schemaVersion: 1,
    updatedAt: 77,
    highestUnlockedLevel: 6,
    coins: 45,
    levels: {
      1: { stars: 3, bestScore: 900 },
      5: { stars: 1, bestScore: 300 },
    },
    tutorialCompleted: false,
    ...extra,
  });

describe('progress v1 -> v2 migration', () => {
  it('moves coins into the wallet and keeps everything else', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, v1());
    const s = createProgressStore(storage, clock()).getState();
    expect(s).toMatchObject({
      highestUnlockedLevel: 6,
      coins: 45,
      updatedAt: 77,
      inventory: {},
      loadIssue: 'none',
      levels: {
        1: { stars: 3, bestScore: 900 },
        5: { stars: 1, bestScore: 300 },
      },
    });
  });

  it('does not write on load, so a v1 document stays v1 until something is saved', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, v1());
    createProgressStore(storage, clock());
    expect(JSON.parse(storage.getString(KEY) as string).schemaVersion).toBe(1);
  });

  it('writes the current shape on the next save', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, v1());
    const store = createProgressStore(storage, clock(9000));
    store
      .getState()
      .recordResult({ levelId: 6, stars: 2, score: 400, coins: 20 });
    const saved = JSON.parse(storage.getString(KEY) as string);
    expect(saved).toMatchObject({
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      updatedAt: 9000,
      highestUnlockedLevel: 7,
      wallet: { coins: 65 },
      inventory: {},
      tutorialCompleted: false,
    });
    expect('coins' in saved).toBe(false);
  });

  it('a migrated document is read back identically after a restart', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, v1());
    const first = createProgressStore(storage, clock());
    first
      .getState()
      .recordResult({ levelId: 2, stars: 1, score: 50, coins: 15 });
    const second = createProgressStore(storage, clock()).getState();
    expect(second.coins).toBe(60);
    expect(second.levels[2]).toEqual({ stars: 1, bestScore: 50 });
  });

  it('keeps the tutorial flag when v1 already had it', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      KEY,
      v1({ tutorialCompleted: true, highestUnlockedLevel: 3 }),
    );
    expect(
      createProgressStore(storage, clock()).getState().tutorialCompleted,
    ).toBe(true);
  });

  it('settles the tutorial flag from progress when v1 had none', () => {
    const past = new InMemoryStorage();
    past.setString(
      KEY,
      v1({ tutorialCompleted: undefined, highestUnlockedLevel: 25 }),
    );
    expect(
      createProgressStore(past, clock()).getState().tutorialCompleted,
    ).toBe(true);

    const inside = new InMemoryStorage();
    inside.setString(
      KEY,
      v1({ tutorialCompleted: undefined, highestUnlockedLevel: 4 }),
    );
    expect(
      createProgressStore(inside, clock()).getState().tutorialCompleted,
    ).toBe(false);
  });

  it('turns a nonsense coin value into zero rather than failing', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, v1({ coins: 'lots' }));
    const s = createProgressStore(storage, clock()).getState();
    expect(s.coins).toBe(0);
    expect(s.highestUnlockedLevel).toBe(6);
  });
});

describe('progress v2 sanitizing', () => {
  const v2 = (o: Record<string, unknown>) =>
    JSON.stringify({ schemaVersion: 2, ...o });

  it('reads a well-formed current document', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      KEY,
      v2({
        updatedAt: 3,
        highestUnlockedLevel: 12,
        wallet: { coins: 70 },
        inventory: { undo: 2, hint: 1 },
        levels: { 3: { stars: 2, bestScore: 10 } },
        tutorialCompleted: true,
      }),
    );
    expect(createProgressStore(storage, clock()).getState()).toMatchObject({
      highestUnlockedLevel: 12,
      coins: 70,
      inventory: { undo: 2, hint: 1 },
      tutorialCompleted: true,
      levels: { 3: { stars: 2, bestScore: 10 } },
    });
  });

  it('replaces only the bad fields with defaults', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      KEY,
      v2({
        highestUnlockedLevel: -4,
        wallet: { coins: 'x' },
        inventory: { undo: 2, bad: -1, worse: 1.5, text: 'y' },
        levels: { 1: { stars: 3, bestScore: 5 }, 2: null, 3: { stars: 'x' } },
        tutorialCompleted: 'yes',
      }),
    );
    const s = createProgressStore(storage, clock()).getState();
    expect(s.highestUnlockedLevel).toBe(1);
    expect(s.coins).toBe(0);
    expect(s.inventory).toEqual({ undo: 2 });
    expect(s.levels).toEqual({ 1: { stars: 3, bestScore: 5 } });
    expect(s.tutorialCompleted).toBe(false);
  });

  it('copes with missing wallet, inventory and levels', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, v2({ highestUnlockedLevel: 2 }));
    expect(createProgressStore(storage, clock()).getState()).toMatchObject({
      highestUnlockedLevel: 2,
      coins: 0,
      inventory: {},
      levels: {},
    });
  });

  it('keeps inventory through a save', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, v2({ inventory: { shuffle: 3 } }));
    const store = createProgressStore(storage, clock());
    store.getState().recordResult({ levelId: 1, stars: 1, score: 1, coins: 0 });
    expect(JSON.parse(storage.getString(KEY) as string).inventory).toEqual({
      shuffle: 3,
    });
  });
});

describe('unreadable progress is never lost silently', () => {
  it('falls back to defaults on corrupt data without touching it', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, '{broken');
    const s = createProgressStore(storage, clock()).getState();
    expect(s).toMatchObject({
      loadIssue: 'corrupt',
      highestUnlockedLevel: 1,
      coins: 0,
    });
    expect(storage.getString(KEY)).toBe('{broken');
    expect(storage.contains(BACKUP)).toBe(false);
  });

  it('backs the corrupt text up just before the first save replaces it', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, '{broken');
    const store = createProgressStore(storage, clock());
    store
      .getState()
      .recordResult({ levelId: 1, stars: 1, score: 1, coins: 15 });
    expect(storage.getString(BACKUP)).toBe('{broken');
    expect(JSON.parse(storage.getString(KEY) as string).schemaVersion).toBe(3);
  });

  it('backs up only once, not on every later save', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, 'garbage');
    const store = createProgressStore(storage, clock());
    store.getState().recordResult({ levelId: 1, stars: 1, score: 1, coins: 0 });
    storage.setString(BACKUP, 'edited-by-hand');
    store.getState().recordResult({ levelId: 2, stars: 1, score: 1, coins: 0 });
    expect(storage.getString(BACKUP)).toBe('edited-by-hand');
  });

  it('treats a document from a newer app as unreadable and preserves it', () => {
    const storage = new InMemoryStorage();
    const newer = JSON.stringify({
      schemaVersion: 9,
      coins: 999,
      extra: 'new',
    });
    storage.setString(KEY, newer);
    const store = createProgressStore(storage, clock());
    expect(store.getState()).toMatchObject({ loadIssue: 'future', coins: 0 });
    expect(storage.getString(KEY)).toBe(newer);

    store.getState().recordResult({ levelId: 1, stars: 1, score: 1, coins: 0 });
    expect(storage.getString(BACKUP)).toBe(newer);
  });

  it('makes no backup when there was nothing wrong', () => {
    const storage = new InMemoryStorage();
    const store = createProgressStore(storage, clock());
    store.getState().recordResult({ levelId: 1, stars: 1, score: 1, coins: 0 });
    expect(storage.contains(BACKUP)).toBe(false);
    expect(store.getState().loadIssue).toBe('none');
  });

  it('makes no backup for a document that merely needed migrating', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, v1());
    const store = createProgressStore(storage, clock());
    store.getState().recordResult({ levelId: 1, stars: 1, score: 1, coins: 0 });
    expect(storage.contains(BACKUP)).toBe(false);
  });

  it('a save by completeTutorial also triggers the backup', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, 'not json');
    createProgressStore(storage, clock()).getState().completeTutorial();
    expect(storage.getString(BACKUP)).toBe('not json');
  });
});
