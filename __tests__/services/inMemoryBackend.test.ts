import { InMemoryBackend } from '@services/cloud/InMemoryBackend';
import { NoopCloudSave } from '@services/cloud/NoopCloudSave';
import { NoopLeaderboard } from '@services/leaderboard/NoopLeaderboard';
import {
  fixedSource,
  honestClaim,
  tinyLevel,
  tinyWin,
  tinyWinSlow,
} from '../testUtils';

const level = tinyLevel(4);
const newBackend = () => new InMemoryBackend(fixedSource(tinyLevel));

describe('cloud save semantics', () => {
  it('has nothing stored for a new player', async () => {
    const { cloud } = newBackend().client('ann');
    await expect(cloud.pull()).resolves.toBeNull();
  });

  it('stores a payload when the caller says nothing was stored before', async () => {
    const { cloud } = newBackend().client('ann');
    const result = await cloud.push('hello', null);
    expect(result.ok).toBe(true);
    await expect(cloud.pull()).resolves.toMatchObject({ payload: 'hello' });
  });

  it('gives a new revision on every accepted push', async () => {
    const { cloud } = newBackend().client('ann');
    const first = await cloud.push('a', null);
    const second = await cloud.push('b', first.ok ? first.revision : null);
    expect(first.ok && second.ok && first.revision !== second.revision).toBe(
      true,
    );
  });

  it('refuses a push that names an old revision, and returns what is stored now', async () => {
    const { cloud } = newBackend().client('ann');
    const first = await cloud.push('a', null);
    await cloud.push('b', first.ok ? first.revision : null);
    const stale = await cloud.push('c', first.ok ? first.revision : null);
    expect(stale.ok).toBe(false);
    if (!stale.ok) {
      expect(stale.reason).toBe('conflict');
      expect(stale.current.payload).toBe('b');
    }
    await expect(cloud.pull()).resolves.toMatchObject({ payload: 'b' });
  });

  it('refuses "nothing stored yet" when something is stored', async () => {
    const { cloud } = newBackend().client('ann');
    await cloud.push('a', null);
    const result = await cloud.push('b', null);
    expect(result.ok).toBe(false);
  });

  it('keeps players apart', async () => {
    const backend = newBackend();
    await backend.client('ann').cloud.push('ann-data', null);
    await expect(backend.client('bob').cloud.pull()).resolves.toBeNull();
  });

  it('fails like a dropped connection when offline, and recovers', async () => {
    const backend = newBackend();
    const { cloud } = backend.client('ann');
    backend.offline = true;
    await expect(cloud.pull()).rejects.toThrow('Network');
    await expect(cloud.push('x', null)).rejects.toThrow('Network');
    backend.offline = false;
    await expect(cloud.pull()).resolves.toBeNull();
  });

  it('can be told to plant data as if another device saved it', async () => {
    const backend = newBackend();
    backend.plant('ann', 'from-elsewhere');
    await expect(backend.client('ann').cloud.pull()).resolves.toMatchObject({
      payload: 'from-elsewhere',
    });
  });
});

describe('leaderboard: verification', () => {
  it('accepts an honest run', async () => {
    const { leaderboard } = newBackend().client('ann');
    await expect(
      leaderboard.submit(honestClaim(level, tinyWin)),
    ).resolves.toEqual({
      status: 'accepted',
      rank: 1,
    });
  });

  it('refuses a forged score, giving the reason', async () => {
    const { leaderboard } = newBackend().client('ann');
    const forged = { ...honestClaim(level, tinyWin), score: 99999 };
    await expect(leaderboard.submit(forged)).resolves.toEqual({
      status: 'rejected',
      reason: 'SCORE_MISMATCH',
    });
  });

  it('refuses a log that does not win', async () => {
    const { leaderboard } = newBackend().client('ann');
    const partial = honestClaim(level, tinyWin.slice(0, 4));
    await expect(leaderboard.submit(partial)).resolves.toMatchObject({
      status: 'rejected',
      reason: 'NOT_WON',
    });
  });

  it('refuses a run for a level it does not have', async () => {
    const backend = new InMemoryBackend({
      getLevel: async () => {
        throw new Error('no such level');
      },
    });
    const result = await backend
      .client('ann')
      .leaderboard.submit(honestClaim(level, tinyWin));
    expect(result).toEqual({ status: 'rejected', reason: 'UNKNOWN_LEVEL' });
  });

  it('puts nothing on the board for a refused run', async () => {
    const { leaderboard } = newBackend().client('ann');
    await leaderboard.submit({ ...honestClaim(level, tinyWin), score: 1 });
    await expect(leaderboard.top(4, 10)).resolves.toEqual([]);
  });
});

describe('leaderboard: ranking', () => {
  async function seed() {
    const backend = newBackend();
    const ann = backend.client('ann', 'Ann');
    const bob = backend.client('bob', 'Bob');
    const cy = backend.client('cy', 'Cy');
    await ann.leaderboard.submit(honestClaim(level, tinyWinSlow)); // lower score
    await bob.leaderboard.submit(honestClaim(level, tinyWin)); // higher score
    return { backend, ann, bob, cy };
  }

  it('ranks by score, best first', async () => {
    const { ann } = await seed();
    const top = await ann.leaderboard.top(4, 10);
    expect(top.map(e => e.name)).toEqual(['Bob', 'Ann']);
    expect(top.map(e => e.rank)).toEqual([1, 2]);
    expect(top[0]!.score).toBeGreaterThan(top[1]!.score);
  });

  it("reports the trusted numbers, not the client's", async () => {
    const { ann } = await seed();
    const top = await ann.leaderboard.top(4, 10);
    expect(top[0]).toMatchObject({
      score: 510,
      stars: 3,
      moves: 6,
      boostersUsed: 0,
    });
  });

  it("marks the asking player's own entry", async () => {
    const { ann, bob } = await seed();
    expect((await ann.leaderboard.top(4, 10)).map(e => e.isYou)).toEqual([
      false,
      true,
    ]);
    expect((await bob.leaderboard.top(4, 10)).map(e => e.isYou)).toEqual([
      true,
      false,
    ]);
  });

  it('respects the limit', async () => {
    const { ann } = await seed();
    expect(await ann.leaderboard.top(4, 1)).toHaveLength(1);
    expect(await ann.leaderboard.top(4, 0)).toHaveLength(0);
  });

  it("keeps only each player's best run", async () => {
    const { ann } = await seed();
    await ann.leaderboard.submit(honestClaim(level, tinyWin)); // improves Ann
    const top = await ann.leaderboard.top(4, 10);
    expect(top).toHaveLength(2);
    expect(top.find(e => e.name === 'Ann')!.score).toBe(510);
  });

  it('does not let a worse run replace a better one', async () => {
    const { bob } = await seed();
    await bob.leaderboard.submit(honestClaim(level, tinyWinSlow));
    expect((await bob.leaderboard.top(4, 10))[0]).toMatchObject({
      name: 'Bob',
      score: 510,
    });
  });

  it('breaks an exact score tie by fewer moves, then by who was first', async () => {
    const backend = newBackend();
    const first = backend.client('p1', 'First');
    const second = backend.client('p2', 'Second');
    const wasteful = [
      ...tinyWin.slice(0, 1),
      { type: 'HINT' as const },
      ...tinyWin.slice(1),
    ];
    await first.leaderboard.submit(honestClaim(level, tinyWin));
    await second.leaderboard.submit(honestClaim(level, tinyWin));
    let top = await first.leaderboard.top(4, 10);
    expect(top.map(e => e.name)).toEqual(['First', 'Second']);
    // A run with the same score and the same moves but a booster still ties on both, so order stays.
    await backend
      .client('p3', 'Third')
      .leaderboard.submit(honestClaim(level, wasteful));
    top = await first.leaderboard.top(4, 10);
    expect(top.map(e => e.name)).toEqual(['First', 'Second', 'Third']);
  });

  it('reports the rank the player reached', async () => {
    const { cy } = await seed();
    await expect(
      cy.leaderboard.submit(honestClaim(level, tinyWin)),
    ).resolves.toEqual({
      status: 'accepted',
      rank: 2,
    });
  });

  it('keeps levels separate', async () => {
    const { ann } = await seed();
    await expect(ann.leaderboard.top(5, 10)).resolves.toEqual([]);
  });

  it('fails like a dropped connection when offline', async () => {
    const backend = newBackend();
    const { leaderboard } = backend.client('ann');
    backend.offline = true;
    await expect(
      leaderboard.submit(honestClaim(level, tinyWin)),
    ).rejects.toThrow('Network');
    await expect(leaderboard.top(4, 5)).rejects.toThrow('Network');
  });
});

describe('the placeholders used until a provider is connected', () => {
  it('report themselves unavailable', () => {
    expect(new NoopCloudSave().isAvailable).toBe(false);
    expect(new NoopLeaderboard().isAvailable).toBe(false);
  });

  it('behave harmlessly', async () => {
    await expect(new NoopCloudSave().pull()).resolves.toBeNull();
    await expect(new NoopCloudSave().push('x', null)).rejects.toThrow(
      'not connected',
    );
    await expect(new NoopLeaderboard().top(1, 5)).resolves.toEqual([]);
    await expect(
      new NoopLeaderboard().submit(honestClaim(level, tinyWin)),
    ).rejects.toThrow('not connected');
  });
});
