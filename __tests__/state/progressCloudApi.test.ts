import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import {
  PROGRESS_SCHEMA_VERSION,
  createProgressStore,
  readProgressDocument,
} from '@state/progressStore';
import type { ProgressDocument } from '@state/progressStore';

const clock = (start = 1000) => {
  let now = start;
  return { now: () => now++ };
};

const KEY = 'player.progress';

const remoteDoc = (over: Partial<ProgressDocument> = {}): ProgressDocument => ({
  schemaVersion: PROGRESS_SCHEMA_VERSION,
  updatedAt: 0,
  highestUnlockedLevel: 1,
  levels: {},
  wallet: { coins: 0 },
  inventory: {},
  tutorialCompleted: false,
  dailyReward: { lastClaimDay: null, streak: 0 },
  ...over,
});

describe('exportDocument', () => {
  it('describes the whole progress in the stored shape', () => {
    const store = createProgressStore(new InMemoryStorage(), clock(500));
    store
      .getState()
      .recordResult({ levelId: 2, stars: 2, score: 300, coins: 20 });
    expect(store.getState().exportDocument()).toEqual({
      schemaVersion: PROGRESS_SCHEMA_VERSION,
      updatedAt: 500,
      highestUnlockedLevel: 3,
      levels: { 2: { stars: 2, bestScore: 300 } },
      wallet: { coins: 20 },
      inventory: {},
      tutorialCompleted: false,
      dailyReward: { lastClaimDay: null, streak: 0 },
    });
  });

  it('is exactly what is saved on the device', () => {
    const storage = new InMemoryStorage();
    const store = createProgressStore(storage, clock());
    store.getState().credit({ coins: 5, boosters: { undo: 1 } });
    expect(store.getState().exportDocument()).toEqual(
      JSON.parse(storage.getString(KEY) as string),
    );
  });
});

describe('mergeRemote', () => {
  it('takes in progress made on another device and saves it', () => {
    const storage = new InMemoryStorage();
    const store = createProgressStore(storage, clock());
    const changed = store.getState().mergeRemote(
      remoteDoc({
        updatedAt: 50,
        highestUnlockedLevel: 12,
        levels: { 11: { stars: 3, bestScore: 800 } },
        wallet: { coins: 90 },
        inventory: { hint: 2 },
        tutorialCompleted: true,
      }),
    );
    expect(changed).toBe(true);
    expect(store.getState()).toMatchObject({
      highestUnlockedLevel: 12,
      coins: 90,
      inventory: { hint: 2 },
      tutorialCompleted: true,
      updatedAt: 50,
      levels: { 11: { stars: 3, bestScore: 800 } },
    });
    const again = createProgressStore(storage, clock()).getState();
    expect(again.highestUnlockedLevel).toBe(12);
    expect(again.coins).toBe(90);
  });

  it('keeps the timestamp of the data it took in (a merge is not a player action)', () => {
    const store = createProgressStore(new InMemoryStorage(), clock(9999));
    store
      .getState()
      .mergeRemote(remoteDoc({ updatedAt: 42, highestUnlockedLevel: 5 }));
    expect(store.getState().updatedAt).toBe(42);
  });

  it('returns false and writes nothing when there is nothing new', () => {
    const storage = new InMemoryStorage();
    const store = createProgressStore(storage, clock());
    store
      .getState()
      .recordResult({ levelId: 1, stars: 3, score: 900, coins: 25 });
    const saved = storage.getString(KEY);
    const same = store.getState().exportDocument();
    expect(store.getState().mergeRemote(same)).toBe(false);
    expect(store.getState().mergeRemote(remoteDoc())).toBe(false);
    expect(storage.getString(KEY)).toBe(saved);
  });

  it('is idempotent: applying the same remote twice changes nothing the second time', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    const remote = remoteDoc({ updatedAt: 9, highestUnlockedLevel: 7 });
    expect(store.getState().mergeRemote(remote)).toBe(true);
    expect(store.getState().mergeRemote(remote)).toBe(false);
  });

  it('never lowers what this device already achieved', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    store
      .getState()
      .recordResult({ levelId: 20, stars: 3, score: 999, coins: 0 });
    store.getState().mergeRemote(
      remoteDoc({
        highestUnlockedLevel: 3,
        levels: { 20: { stars: 1, bestScore: 10 } },
      }),
    );
    expect(store.getState().highestUnlockedLevel).toBe(21);
    expect(store.getState().levels[20]).toEqual({ stars: 3, bestScore: 999 });
  });

  it('ignores a wallet from an older document', () => {
    const store = createProgressStore(new InMemoryStorage(), clock(1000));
    store.getState().credit({ coins: 40 }); // updatedAt 1000
    store
      .getState()
      .mergeRemote(remoteDoc({ updatedAt: 10, wallet: { coins: 5000 } }));
    expect(store.getState().coins).toBe(40);
  });

  it('does not hand out the starter boosters a second time', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    // The other device already finished the tutorial and got its boosters.
    store.getState().mergeRemote(
      remoteDoc({
        updatedAt: 50,
        tutorialCompleted: true,
        inventory: { undo: 1, hint: 1, shuffle: 1 },
      }),
    );
    expect(store.getState().tutorialCompleted).toBe(true);
    expect(store.getState().inventory).toEqual({
      undo: 1,
      hint: 1,
      shuffle: 1,
    });
    store.getState().completeTutorial(); // already done: no second grant
    expect(store.getState().inventory).toEqual({
      undo: 1,
      hint: 1,
      shuffle: 1,
    });
  });

  it('notifies subscribers exactly once per real change', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    let changes = 0;
    store.subscribe(() => changes++);
    const remote = remoteDoc({ updatedAt: 3, highestUnlockedLevel: 4 });
    store.getState().mergeRemote(remote);
    store.getState().mergeRemote(remote);
    expect(changes).toBe(1);
  });
});

describe('readProgressDocument (used for anything that comes from outside)', () => {
  it('reads a current document', () => {
    const read = readProgressDocument(
      JSON.stringify(remoteDoc({ updatedAt: 8 })),
    );
    expect(read).toEqual({ kind: 'ok', doc: remoteDoc({ updatedAt: 8 }) });
  });

  it('upgrades an old version on the way in', () => {
    const read = readProgressDocument(
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: 3,
        highestUnlockedLevel: 6,
        coins: 45,
        levels: {},
      }),
    );
    expect(read.kind).toBe('ok');
    if (read.kind === 'ok') {
      expect(read.doc.wallet.coins).toBe(45);
      expect(read.doc.schemaVersion).toBe(PROGRESS_SCHEMA_VERSION);
    }
  });

  it('cleans up bad fields instead of trusting them', () => {
    const read = readProgressDocument(
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: -5,
        highestUnlockedLevel: 'many',
        levels: { 1: { stars: 3, bestScore: 10 }, x: { stars: 1 }, 2: null },
        wallet: { coins: -100 },
        inventory: { undo: 2, evil: -9 },
        tutorialCompleted: 'yes',
      }),
    );
    expect(read).toEqual({
      kind: 'ok',
      doc: remoteDoc({
        levels: { 1: { stars: 3, bestScore: 10 } },
        inventory: { undo: 2 },
      }),
    });
  });

  it.each([
    ['nothing', undefined, 'none'],
    ['empty text', '', 'none'],
    ['broken JSON', '{nope', 'corrupt'],
    ['a number', '5', 'corrupt'],
    ['no version', '{"coins": 5}', 'corrupt'],
    ["a newer app's document", '{"schemaVersion": 99}', 'future'],
  ])('reports %s', (_name, raw, kind) => {
    expect(readProgressDocument(raw as string | undefined).kind).toBe(kind);
  });
});
