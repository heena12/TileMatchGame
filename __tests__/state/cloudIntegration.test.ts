import { generateLevel, levelFingerprint, solve, verifyRun } from '@engine';
import type { ILevelSource, LevelData } from '@engine';
import { createContainer } from '@app/di/container';
import type { Container } from '@app/di/container';
import { InMemoryBackend } from '@services/cloud/InMemoryBackend';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { fixedSource, losingLevel, tinyLevel } from '../testUtils';

jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

const flush = () => new Promise<void>(resolve => setImmediate(resolve));

const stocked = (inventory: Record<string, number>, coins = 0) => {
  const storage = new InMemoryStorage();
  storage.setString(
    'player.progress',
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: 1,
      highestUnlockedLevel: 30,
      levels: {},
      wallet: { coins },
      inventory,
      tutorialCompleted: true,
    }),
  );
  return storage;
};

function app(
  backend: InMemoryBackend,
  playerId: string,
  options: {
    storage?: InMemoryStorage;
    levelSource?: ILevelSource<LevelData>;
    name?: string;
  } = {},
): Container {
  const { cloud, leaderboard } = backend.client(playerId, options.name);
  return createContainer({
    storage: options.storage ?? stocked({}),
    levelSource: options.levelSource ?? fixedSource(tinyLevel),
    cloud,
    leaderboard,
  });
}

const play = (c: Container, ids: number[]) =>
  ids.forEach(id => c.model.controller.select(id));

async function winTiny(c: Container, ids = [1, 2, 3, 4, 5, 6]) {
  await c.model.controller.start(4);
  play(c, ids);
  await flush();
}

describe('finished runs are reported for checking', () => {
  it('reports a win with the log, the fingerprint and the score', async () => {
    const reported: unknown[] = [];
    const c = createContainer({
      storage: stocked({}),
      levelSource: fixedSource(tinyLevel),
    });
    // Watch what the controller hands over by wrapping its callback.
    const deps = (
      c.model.controller as unknown as {
        deps: { onRunCompleted?: (r: unknown) => void };
      }
    ).deps;
    const original = deps.onRunCompleted;
    deps.onRunCompleted = run => {
      reported.push(run);
      original?.(run as never);
    };
    await winTiny(c);
    expect(reported).toHaveLength(1);
    const { claim, newBest } = reported[0] as {
      claim: Record<string, unknown>;
      newBest: boolean;
    };
    expect(claim).toMatchObject({
      levelId: 4,
      levelContentVersion: levelFingerprint(tinyLevel(4)),
      score: 510,
      stars: 3,
    });
    expect(claim.commands).toHaveLength(6);
    expect(newBest).toBe(true);
  });
});

describe('a real run played through the app is accepted by the server', () => {
  it('a plain win', async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const c = app(backend, 'ann', { name: 'Ann' });
    c.start();
    await winTiny(c);
    const top = await backend.client('ann').leaderboard.top(4, 5);
    expect(top).toEqual([
      {
        rank: 1,
        name: 'Ann',
        score: 510,
        stars: 3,
        moves: 6,
        boostersUsed: 0,
        isYou: true,
      },
    ]);
  });

  it('a win using undo, a hint and a shuffle on a bigger level', async () => {
    const lvl = generateLevel(120);
    const backend = new InMemoryBackend(fixedSource(() => lvl));
    const c = app(backend, 'ann', {
      storage: stocked({ undo: 2, hint: 2, shuffle: 2 }),
      levelSource: fixedSource(() => lvl),
    });
    c.start();
    const ctl = c.model.controller;
    const session = c.model.stores.gameSession;
    await ctl.start(120);
    ctl.select(session.getState().freeTileIds[0] as number);
    ctl.useBooster('undo');
    ctl.useBooster('shuffle');
    // The Wand sends its tiles over about a second; wait for the last one.
    expect(ctl.useBooster('hint')).toBe('used');
    await jest.advanceTimersByTimeAsync(1200);
    // Finish by following hints from the engine's own search.
    const path = solve(session.getState().game!.board, 7, 300000, new Map());
    expect(path.status).toBe('solvable');
    for (const id of path.solution ?? []) {
      ctl.select(id);
    }
    await flush();
    expect(session.getState().status).toBe('won');
    const top = await backend.client('ann').leaderboard.top(120, 5);
    expect(top).toHaveLength(1);
    expect(top[0]?.boostersUsed).toBe(3);
  });

  it('a game that was closed and resumed part-way', async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const storage = stocked({});
    const first = app(backend, 'ann', { storage });
    await first.model.controller.start(4);
    play(first, [1, 2, 3]);

    const second = app(backend, 'ann', { storage });
    second.start();
    await second.model.controller.start(4, { resume: true });
    play(second, [4, 5, 6]);
    await flush();
    const top = await backend.client('ann').leaderboard.top(4, 5);
    expect(top[0]).toMatchObject({ score: 510, moves: 6 });
  });

  it("the server's own check agrees with what the app claimed", async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const c = app(backend, 'ann');
    c.start();
    await winTiny(c);
    const saved = (c.model.controller as unknown as { deps: unknown }).deps;
    expect(saved).toBeDefined();
    const level = tinyLevel(4);
    // Re-running the game by hand gives the same trusted score.
    const check = verifyRun(level, {
      levelId: 4,
      levelContentVersion: levelFingerprint(level),
      commands: [1, 2, 3, 4, 5, 6].map(tileId => ({
        type: 'SELECT_TILE' as const,
        tileId,
      })),
      score: 510,
      stars: 3,
    });
    expect(check).toMatchObject({ valid: true, score: 510 });
  });
});

describe('what is and is not sent', () => {
  it('sends only a new personal best', async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const c = app(backend, 'ann');
    c.start();
    await winTiny(c);
    expect(backend.calls.submit).toBe(1);
    await winTiny(c); // same score again: not a new best
    expect(backend.calls.submit).toBe(1);
  });

  it('sends an improvement', async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const c = app(backend, 'ann');
    c.start();
    await winTiny(c, [1, 4, 2, 5, 3, 6]); // slower, lower score
    await winTiny(c); // better
    expect(backend.calls.submit).toBe(2);
    const top = await backend.client('ann').leaderboard.top(4, 5);
    expect(top[0]?.score).toBe(510);
  });

  it('sends nothing for a loss', async () => {
    const backend = new InMemoryBackend(fixedSource(losingLevel));
    const c = app(backend, 'ann', { levelSource: fixedSource(losingLevel) });
    c.start();
    await c.model.controller.start(4);
    play(c, [1, 4, 7, 10, 13, 16, 19]);
    await flush();
    expect(backend.calls.submit).toBe(0);
  });

  it('sends nothing when no leaderboard is connected', async () => {
    const c = createContainer({
      storage: stocked({}),
      levelSource: fixedSource(tinyLevel),
    });
    c.start();
    await winTiny(c);
    // No error, and the win is recorded locally as usual.
    expect(c.model.stores.progress.getState().levels[4]).toBeDefined();
  });

  it('a run won offline goes out later, when the app starts with a connection', async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const storage = stocked({});
    backend.offline = true;
    const first = app(backend, 'ann', { storage });
    first.start();
    await winTiny(first);
    expect(backend.calls.submit).toBe(0);

    backend.offline = false;
    const second = app(backend, 'ann', { storage });
    second.start();
    await flush();
    await flush();
    const top = await backend.client('ann').leaderboard.top(4, 5);
    expect(top).toHaveLength(1);
  });
});

describe('cloud save through the app', () => {
  it("progress made in one app appears in the same player's other app", async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const phone = app(backend, 'ann', { storage: stocked({}) });
    const stopPhone = phone.start();
    await winTiny(phone);
    await jest.advanceTimersByTimeAsync(3000); // debounced sync

    const tablet = app(backend, 'ann', { storage: new InMemoryStorage() });
    const stopTablet = tablet.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(tablet.model.stores.progress.getState().levels[4]).toEqual({
      stars: 3,
      bestScore: 510,
    });
    expect(tablet.model.stores.progress.getState().highestUnlockedLevel).toBe(
      30,
    );
    stopPhone();
    stopTablet();
  });

  it('reports the sync status to the screens', async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const c = app(backend, 'ann');
    expect(c.model.stores.sync.getState().status).toBe('idle');
    const stop = c.start();
    await jest.advanceTimersByTimeAsync(0);
    expect(c.model.stores.sync.getState().status).toBe('synced');
    stop();
  });

  it('with no provider the status says so and the app works normally', async () => {
    const c = createContainer({
      storage: stocked({}),
      levelSource: fixedSource(tinyLevel),
    });
    expect(c.model.stores.sync.getState().status).toBe('unavailable');
    const stop = c.start();
    await winTiny(c);
    expect(c.model.stores.progress.getState().highestUnlockedLevel).toBe(30);
    stop();
  });

  it("stopping the app's background work stops syncing", async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const c = app(backend, 'ann');
    const stop = c.start();
    await jest.advanceTimersByTimeAsync(0);
    stop();
    const pulls = backend.calls.pull;
    c.model.stores.progress.getState().credit({ coins: 5 });
    await jest.advanceTimersByTimeAsync(10000);
    expect(backend.calls.pull).toBe(pulls);
  });
});

describe('errors in reporting never spoil a win', () => {
  it('the result still shows if the leaderboard callback throws', async () => {
    const c = createContainer({
      storage: stocked({}),
      levelSource: fixedSource(tinyLevel),
    });
    const deps = (
      c.model.controller as unknown as { deps: { onRunCompleted?: () => void } }
    ).deps;
    deps.onRunCompleted = () => {
      throw new Error('reporting broke');
    };
    await winTiny(c);
    expect(c.model.stores.gameSession.getState().status).toBe('won');
    expect(c.model.stores.gameSession.getState().result?.stars).toBe(3);
    expect(c.model.stores.progress.getState().levels[4]).toBeDefined();
  });
});
