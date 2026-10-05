import { InMemoryBackend } from '@services/cloud/InMemoryBackend';
import type {
  CloudSnapshot,
  ICloudSaveService,
  PushResult,
} from '@services/cloud/ICloudSaveService';
import { NoopCloudSave } from '@services/cloud/NoopCloudSave';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import {
  PROGRESS_SCHEMA_VERSION,
  canonicalJson,
} from '@state/persistence/progressDocument';
import { createProgressStore } from '@state/progressStore';
import { SyncService } from '@state/sync/SyncService';
import { createSyncStore } from '@state/sync/syncStore';
import { fixedSource, tinyLevel } from '../testUtils';

jest.useFakeTimers();

/** One shared, ever-rising clock so "newer" means the same on every device. */
let time = 1000;
const clock = { now: () => time++ };

function device(cloud: ICloudSaveService, debounceMs?: number) {
  const storage = new InMemoryStorage();
  const progress = createProgressStore(storage, clock);
  const store = createSyncStore(cloud.isAvailable ? 'idle' : 'unavailable');
  const sync = new SyncService({ cloud, progress, store, clock, debounceMs });
  return { storage, progress, store, sync };
}

const newBackend = () => new InMemoryBackend(fixedSource(tinyLevel));
const doc = (d: ReturnType<typeof device>) =>
  canonicalJson(d.progress.getState().exportDocument());
const win = (
  d: ReturnType<typeof device>,
  levelId: number,
  stars = 3,
  score = 500,
  coins = 25,
) => d.progress.getState().recordResult({ levelId, stars, score, coins });

beforeEach(() => {
  time = 1000;
});

describe('SyncService: two devices', () => {
  it("sends a device's progress to the cloud, and a new device receives it", async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    win(a, 2, 2, 300, 20);
    await expect(a.sync.syncNow()).resolves.toBe('synced');

    const b = device(backend.client('ann').cloud);
    await expect(b.sync.syncNow()).resolves.toBe('synced');
    expect(b.progress.getState().highestUnlockedLevel).toBe(3);
    expect(b.progress.getState().levels[1]).toEqual({
      stars: 3,
      bestScore: 500,
    });
    expect(b.progress.getState().coins).toBe(45);
    expect(doc(b)).toBe(doc(a));
  });

  it('merges progress made on both devices while they were apart', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    const b = device(backend.client('ann').cloud);
    win(a, 1);
    win(a, 2);
    win(a, 3);
    win(b, 1, 1, 100, 15);
    win(b, 4, 2, 250, 20);

    await a.sync.syncNow();
    await b.sync.syncNow();
    await a.sync.syncNow();

    expect(doc(a)).toBe(doc(b));
    const merged = a.progress.getState();
    expect(merged.highestUnlockedLevel).toBe(5);
    expect(merged.levels[1]).toEqual({ stars: 3, bestScore: 500 }); // the better of the two
    expect(Object.keys(merged.levels).map(Number).sort()).toEqual([1, 2, 3, 4]);
  });

  it('gives every device the same result whichever syncs first', async () => {
    const results: string[] = [];
    for (const order of [
      ['a', 'b', 'c'],
      ['c', 'b', 'a'],
      ['b', 'a', 'c'],
    ]) {
      time = 1000;
      const backend = newBackend();
      const ds = {
        a: device(backend.client('ann').cloud),
        b: device(backend.client('ann').cloud),
        c: device(backend.client('ann').cloud),
      };
      win(ds.a, 1, 3, 500, 25);
      win(ds.b, 2, 2, 300, 20);
      win(ds.c, 3, 1, 100, 15);
      for (const name of order) {
        await ds[name as 'a' | 'b' | 'c'].sync.syncNow();
      }
      for (const name of ['a', 'b', 'c'] as const) {
        await ds[name].sync.syncNow();
      }
      expect(new Set([doc(ds.a), doc(ds.b), doc(ds.c)]).size).toBe(1);
      results.push(
        ds.a.progress.getState().highestUnlockedLevel +
          ':' +
          Object.keys(ds.a.progress.getState().levels).join(','),
      );
    }
    expect(new Set(results).size).toBe(1);
  });

  it('keeps players separate', async () => {
    const backend = newBackend();
    const ann = device(backend.client('ann').cloud);
    const bob = device(backend.client('bob').cloud);
    win(ann, 7);
    await ann.sync.syncNow();
    await bob.sync.syncNow();
    expect(bob.progress.getState().highestUnlockedLevel).toBe(1);
  });
});

describe('SyncService: not pushing pointlessly', () => {
  it('does not push when the cloud already has everything', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    await a.sync.syncNow();
    const pushes = backend.calls.push;
    await a.sync.syncNow();
    await a.sync.syncNow();
    expect(backend.calls.push).toBe(pushes);
  });

  it('a device that only received data does not push it back', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    await a.sync.syncNow();
    const b = device(backend.client('ann').cloud);
    const pushes = backend.calls.push;
    await b.sync.syncNow();
    expect(backend.calls.push).toBe(pushes);
    expect(b.progress.getState().highestUnlockedLevel).toBe(2);
  });
});

describe('SyncService: conflicts', () => {
  it('merges and retries when another device saved in between', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    const b = device(backend.client('ann').cloud);
    win(a, 1);
    await a.sync.syncNow();
    await b.sync.syncNow(); // b is now at the same revision

    win(a, 2);
    win(b, 3);
    // Just as b is about to push, a's save lands first.
    let raced = false;
    backend.beforePush = playerId => {
      if (!raced) {
        raced = true;
        backend.plant(
          playerId,
          JSON.stringify(a.progress.getState().exportDocument()),
        );
      }
    };
    const pushesBefore = backend.calls.push;
    await expect(b.sync.syncNow()).resolves.toBe('synced');
    // It really was a conflict: two attempts, the first refused and the retry accepted.
    expect(backend.calls.push - pushesBefore).toBe(2);
    expect(raced).toBe(true);
    await a.sync.syncNow();

    expect(doc(a)).toBe(doc(b));
    expect(
      Object.keys(b.progress.getState().levels).map(Number).sort(),
    ).toEqual([1, 2, 3]);
  });

  it('gives up with an error, changing nothing local, if the cloud keeps changing', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    // Every push finds that someone else got there first.
    backend.beforePush = playerId => {
      backend.plant(
        playerId,
        JSON.stringify({
          schemaVersion: PROGRESS_SCHEMA_VERSION,
          updatedAt: 1,
          highestUnlockedLevel: 1,
          levels: {},
          wallet: { coins: 0 },
          inventory: {},
          tutorialCompleted: false,
        }),
      );
    };
    const before = doc(a);
    await expect(a.sync.syncNow()).resolves.toBe('error');
    expect(a.store.getState().status).toBe('error');
    expect(doc(a)).toBe(before);
  });
});

describe('SyncService: bad remote data is never overwritten', () => {
  it('leaves an unreadable cloud copy alone and reports an error', async () => {
    const backend = newBackend();
    backend.plant('ann', '{this is not json');
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    const pushes = backend.calls.push;
    await expect(a.sync.syncNow()).resolves.toBe('error');
    expect(backend.peek('ann')?.payload).toBe('{this is not json');
    expect(backend.calls.push).toBe(pushes);
    expect(a.progress.getState().highestUnlockedLevel).toBe(2);
  });

  it('asks for an app update when the cloud copy is from a newer app', async () => {
    const backend = newBackend();
    const future = JSON.stringify({ schemaVersion: 99, whatever: true });
    backend.plant('ann', future);
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    await expect(a.sync.syncNow()).resolves.toBe('update_required');
    expect(a.store.getState().status).toBe('update_required');
    expect(backend.peek('ann')?.payload).toBe(future);
  });

  it('upgrades an older-format cloud copy on the way in', async () => {
    const backend = newBackend();
    backend.plant(
      'ann',
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: 3,
        highestUnlockedLevel: 9,
        coins: 60,
        levels: { 8: { stars: 2, bestScore: 200 } },
      }),
    );
    const a = device(backend.client('ann').cloud);
    await expect(a.sync.syncNow()).resolves.toBe('synced');
    expect(a.progress.getState().highestUnlockedLevel).toBe(9);
    expect(a.progress.getState().coins).toBe(60);
    expect(JSON.parse(backend.peek('ann')!.payload).schemaVersion).toBe(
      PROGRESS_SCHEMA_VERSION,
    );
  });

  it('treats an empty cloud payload as nothing there', async () => {
    const backend = newBackend();
    backend.plant('ann', '');
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    await expect(a.sync.syncNow()).resolves.toBe('synced');
  });

  it('cleans bad fields in the cloud copy instead of trusting them', async () => {
    const backend = newBackend();
    backend.plant(
      'ann',
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: 5,
        highestUnlockedLevel: 4,
        levels: { 1: { stars: 'lots' } },
        wallet: { coins: -50 },
        inventory: {},
        tutorialCompleted: true,
      }),
    );
    const a = device(backend.client('ann').cloud);
    await a.sync.syncNow();
    expect(a.progress.getState().highestUnlockedLevel).toBe(4);
    expect(a.progress.getState().coins).toBe(0);
    expect(a.progress.getState().levels).toEqual({});
  });
});

describe('SyncService: offline', () => {
  it('reports offline, changes nothing locally, and recovers', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    const before = doc(a);

    backend.offline = true;
    await expect(a.sync.syncNow()).resolves.toBe('offline');
    expect(a.store.getState()).toMatchObject({
      status: 'offline',
      lastSyncedAt: null,
    });
    expect(doc(a)).toBe(before);

    backend.offline = false;
    await expect(a.sync.syncNow()).resolves.toBe('synced');
    expect(backend.peek('ann')).toBeDefined();
    expect(a.store.getState().lastSyncedAt).not.toBeNull();
  });

  it('a push that fails after a good pull still leaves local data safe', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    const b = device(backend.client('ann').cloud);
    win(b, 5);
    await b.sync.syncNow();
    win(a, 1);
    backend.beforePush = () => {
      backend.offline = true;
    };
    await expect(a.sync.syncNow()).resolves.toBe('offline');
    // a did receive b's progress and kept its own.
    expect(a.progress.getState().highestUnlockedLevel).toBe(6);
    expect(a.progress.getState().levels[1]).toBeDefined();
  });
});

describe('SyncService: status and sharing', () => {
  it('moves through syncing to synced and records when', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    const seen: string[] = [];
    a.store.subscribe(s => seen.push(s.status));
    win(a, 1);
    await a.sync.syncNow();
    expect(seen[0]).toBe('syncing');
    expect(seen[seen.length - 1]).toBe('synced');
    expect(a.store.getState().lastSyncedAt).toBeGreaterThan(0);
  });

  it('concurrent requests share one run', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    const results = await Promise.all([
      a.sync.syncNow(),
      a.sync.syncNow(),
      a.sync.syncNow(),
    ]);
    expect(results).toEqual(['synced', 'synced', 'synced']);
    expect(backend.calls.pull).toBe(1);
    expect(backend.calls.push).toBe(1);
  });

  it('can run again after a run finishes', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    await a.sync.syncNow();
    win(a, 1);
    await a.sync.syncNow();
    expect(backend.calls.pull).toBe(2);
  });

  it('says it is available or not', () => {
    const backend = newBackend();
    expect(device(backend.client('ann').cloud).sync.isAvailable).toBe(true);
    expect(device(new NoopCloudSave()).sync.isAvailable).toBe(false);
  });
});

describe('SyncService: no cloud connected', () => {
  it('reports unavailable and makes no calls', async () => {
    const a = device(new NoopCloudSave());
    win(a, 1);
    await expect(a.sync.syncNow()).resolves.toBe('unavailable');
    expect(a.store.getState().status).toBe('unavailable');
    const stop = a.sync.start();
    expect(a.store.getState().status).toBe('unavailable');
    stop();
    expect(a.progress.getState().highestUnlockedLevel).toBe(2);
  });
});

describe('SyncService: background syncing', () => {
  it('syncs once at start', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    win(a, 1);
    const stop = a.sync.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(backend.peek('ann')).toBeDefined();
    expect(a.store.getState().status).toBe('synced');
    stop();
  });

  it('syncs shortly after progress changes, and a burst of changes is one sync', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud, 2000);
    const stop = a.sync.start();
    await jest.advanceTimersByTimeAsync(0);
    const pullsAtStart = backend.calls.pull;

    win(a, 1);
    await jest.advanceTimersByTimeAsync(1000);
    win(a, 2);
    await jest.advanceTimersByTimeAsync(1000);
    win(a, 3);
    expect(backend.calls.pull).toBe(pullsAtStart); // still waiting

    await jest.advanceTimersByTimeAsync(2100);
    expect(backend.calls.pull).toBe(pullsAtStart + 1);
    expect(JSON.parse(backend.peek('ann')!.payload).highestUnlockedLevel).toBe(
      4,
    );
    stop();
  });

  it('does not echo: data received from the cloud does not cause another sync', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud);
    win(a, 4);
    await a.sync.syncNow();

    const b = device(backend.client('ann').cloud, 500);
    const stop = b.sync.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(b.progress.getState().highestUnlockedLevel).toBe(5);
    const pulls = backend.calls.pull;
    await jest.advanceTimersByTimeAsync(10000);
    expect(backend.calls.pull).toBe(pulls);
    stop();
  });

  it('does not miss a change made while a sync is running', async () => {
    const backend = newBackend();
    let release!: () => void;
    const gate = new Promise<void>(res => (release = res));
    const real = backend.client('ann').cloud;
    const slow: ICloudSaveService = {
      isAvailable: true,
      pull: async () => {
        await gate;
        return real.pull();
      },
      push: (payload: string, base: string | null): Promise<PushResult> =>
        real.push(payload, base),
    };
    const a = device(slow, 1000);
    win(a, 1);
    const stop = a.sync.start(); // sync begins, blocked at pull
    await jest.advanceTimersByTimeAsync(0);
    win(a, 2); // changes while it is running
    release();
    await jest.advanceTimersByTimeAsync(0);
    await jest.advanceTimersByTimeAsync(1500);
    expect(JSON.parse(backend.peek('ann')!.payload).highestUnlockedLevel).toBe(
      3,
    );
    stop();
  });

  it('stops syncing when stopped', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud, 500);
    const stop = a.sync.start();
    await jest.advanceTimersByTimeAsync(0);
    stop();
    const pulls = backend.calls.pull;
    win(a, 1);
    await jest.advanceTimersByTimeAsync(5000);
    expect(backend.calls.pull).toBe(pulls);
  });

  it('a manual sync cancels a waiting one rather than running twice', async () => {
    const backend = newBackend();
    const a = device(backend.client('ann').cloud, 3000);
    const stop = a.sync.start();
    await jest.advanceTimersByTimeAsync(0);
    win(a, 1);
    await a.sync.syncNow();
    const pulls = backend.calls.pull;
    await jest.advanceTimersByTimeAsync(5000);
    expect(backend.calls.pull).toBe(pulls);
    stop();
  });
});

describe('the snapshot type is plain data', () => {
  it('is just a payload and a revision', () => {
    const snapshot: CloudSnapshot = { payload: 'x', revision: 'r1' };
    expect(Object.keys(snapshot).sort()).toEqual(['payload', 'revision']);
  });
});
