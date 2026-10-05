import { InMemoryBackend } from '@services/cloud/InMemoryBackend';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import {
  advance,
  byId,
  dump,
  hostByPrefix,
  launch,
  playTiles,
  press,
  toHome,
} from '../harness';
import type { Harness } from '../harness';
import { fixedSource, honestClaim, tinyLevel, tinyWinSlow } from '../testUtils';

jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

const source = fixedSource(tinyLevel);

const stocked = () => {
  const storage = new InMemoryStorage();
  storage.setString(
    'player.progress',
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: 1,
      highestUnlockedLevel: 30,
      levels: {},
      wallet: { coins: 0 },
      inventory: {},
      tutorialCompleted: true,
    }),
  );
  return storage;
};

const newBackend = () => new InMemoryBackend(source);

const withProvider = (backend: InMemoryBackend, player = 'ann', name = 'Ann') =>
  launch(source, stocked(), backend.client(player, name));

async function openSettings(h: Harness) {
  await toHome(h);
  await press(h.r, 'home-settings');
}

const cloudStatus = (h: Harness) => {
  const text = hostByPrefix(h.r, 'cloud-status')[0]?.props.children;
  return Array.isArray(text) ? text.join('') : text;
};

async function winLevel(h: Harness) {
  await toHome(h);
  await press(h.r, 'home-continue');
  await playTiles(h, [1, 2, 3, 4, 5, 6]);
}

describe('Settings: cloud save', () => {
  it('says plainly that no cloud is connected, and offers no sync button', async () => {
    const h = await launch(source, stocked());
    await openSettings(h);
    expect(cloudStatus(h)).toBe('Not connected yet');
    expect(byId(h.r, 'cloud-sync')).toBeUndefined();
  });

  it('shows the state once connected and synced', async () => {
    const h = await withProvider(newBackend());
    await openSettings(h);
    expect(cloudStatus(h)).toBe('Saved to the cloud');
    expect(byId(h.r, 'cloud-sync')).toBeDefined();
  });

  it('"Sync now" syncs again', async () => {
    const backend = newBackend();
    const h = await withProvider(backend);
    await openSettings(h);
    const pulls = backend.calls.pull;
    await press(h.r, 'cloud-sync');
    expect(backend.calls.pull).toBe(pulls + 1);
    expect(cloudStatus(h)).toBe('Saved to the cloud');
  });

  it('shows offline, then recovers', async () => {
    const backend = newBackend();
    const h = await withProvider(backend);
    await openSettings(h);
    backend.offline = true;
    await press(h.r, 'cloud-sync');
    expect(cloudStatus(h)).toBe('Offline, will try again');
    backend.offline = false;
    await press(h.r, 'cloud-sync');
    expect(cloudStatus(h)).toBe('Saved to the cloud');
  });

  it('asks for an app update when the cloud copy is from a newer app', async () => {
    const backend = newBackend();
    backend.plant('ann', JSON.stringify({ schemaVersion: 99 }));
    const h = await withProvider(backend);
    await openSettings(h);
    expect(cloudStatus(h)).toBe('Update the app to sync');
  });

  it('reports a problem when the cloud copy cannot be read, without overwriting it', async () => {
    const backend = newBackend();
    backend.plant('ann', 'garbage');
    const h = await withProvider(backend);
    await openSettings(h);
    expect(cloudStatus(h)).toBe('Sync did not work');
    expect(backend.peek('ann')?.payload).toBe('garbage');
  });

  it('progress made in the game reaches the cloud without any button press', async () => {
    const backend = newBackend();
    const h = await withProvider(backend);
    await winLevel(h);
    await advance(3000);
    const stored = JSON.parse(backend.peek('ann')!.payload);
    expect(stored.levels['30']).toEqual({ stars: 3, bestScore: 510 });
  });
});

describe('Result: leaderboard button', () => {
  it('appears after a win when a leaderboard is connected', async () => {
    const h = await withProvider(newBackend());
    await winLevel(h);
    expect(dump(h.r)).toContain('Level complete!');
    expect(byId(h.r, 'result-leaderboard')).toBeDefined();
  });

  it('is not shown when no leaderboard is connected', async () => {
    const h = await launch(source, stocked());
    await winLevel(h);
    expect(dump(h.r)).toContain('Level complete!');
    expect(byId(h.r, 'result-leaderboard')).toBeUndefined();
  });
});

describe('Leaderboard screen', () => {
  async function openBoard(h: Harness) {
    await winLevel(h);
    await press(h.r, 'result-leaderboard');
  }

  it('lists the best scores for the level, marking the player', async () => {
    const backend = newBackend();
    await backend
      .client('bob', 'Bob')
      .leaderboard.submit(honestClaim(tinyLevel(30), tinyWinSlow));
    const h = await withProvider(backend);
    await openBoard(h);
    // Ann's 510 beats Bob's slower run.
    const rows = hostByPrefix(h.r, 'board-row-');
    expect(rows).toHaveLength(2);
    expect(dump(h.r)).toContain('Level 30');
    expect(rows[0]?.props.accessibilityLabel).toBe(
      '1. You, 510 points, 3 of 3 stars',
    );
    expect(rows[1]?.props.accessibilityLabel).toMatch(/^2\. Bob, \d+ points/);
  });

  it('shows the run that was just won (it went out before the screen opened)', async () => {
    const backend = newBackend();
    const h = await withProvider(backend);
    await openBoard(h);
    expect(hostByPrefix(h.r, 'board-row-')).toHaveLength(1);
    expect(backend.calls.submit).toBe(1);
  });

  it('says so when nobody has a score yet', async () => {
    const backend = newBackend();
    // Offline while winning, so nothing has reached the board yet.
    const h = await withProvider(backend);
    backend.offline = true;
    await winLevel(h);
    backend.offline = false;
    await press(h.r, 'result-leaderboard');
    expect(hostByPrefix(h.r, 'board-empty')).toHaveLength(1);
    expect(dump(h.r)).toContain('No scores yet. Be the first!');
  });

  it('shows an error with a working retry when the scores cannot be loaded', async () => {
    const backend = newBackend();
    const h = await withProvider(backend);
    await winLevel(h);
    backend.offline = true;
    await press(h.r, 'result-leaderboard');
    expect(hostByPrefix(h.r, 'board-error')).toHaveLength(1);
    backend.offline = false;
    await press(h.r, 'board-retry');
    expect(hostByPrefix(h.r, 'board-error')).toHaveLength(0);
    expect(hostByPrefix(h.r, 'board-row-')).toHaveLength(1);
  });

  it('shows only the top ten', async () => {
    const backend = newBackend();
    for (let i = 0; i < 12; i++) {
      await backend
        .client(`p${i}`, `Player ${i}`)
        .leaderboard.submit(honestClaim(tinyLevel(30), tinyWinSlow));
    }
    const h = await withProvider(backend);
    await openBoard(h);
    expect(hostByPrefix(h.r, 'board-row-')).toHaveLength(10);
  });
});
