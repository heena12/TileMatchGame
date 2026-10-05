import type { RunClaim } from '@engine';
import { InMemoryBackend } from '@services/cloud/InMemoryBackend';
import type {
  ILeaderboardService,
  SubmitOutcome,
} from '@services/leaderboard/ILeaderboardService';
import { NoopLeaderboard } from '@services/leaderboard/NoopLeaderboard';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { RunReporter } from '@state/sync/RunReporter';
import {
  fixedSource,
  honestClaim,
  tinyLevel,
  tinyWin,
  tinyWinSlow,
} from '../testUtils';

const KEY = 'leaderboard.queue';

let time = 0;
const clock = { now: () => time++ };

const good = (levelId: number) => honestClaim(tinyLevel(levelId), tinyWin);
const slower = (levelId: number) =>
  honestClaim(tinyLevel(levelId), tinyWinSlow);

function setup(maxQueued?: number) {
  time = 0;
  const backend = new InMemoryBackend(fixedSource(tinyLevel));
  const { leaderboard } = backend.client('ann', 'Ann');
  const storage = new InMemoryStorage();
  const reporter = new RunReporter({ leaderboard, storage, clock, maxQueued });
  return { backend, leaderboard, storage, reporter };
}

describe('RunReporter: sending', () => {
  it('has nothing to do when the queue is empty', async () => {
    const { reporter } = setup();
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 0,
      rejected: 0,
      pending: 0,
    });
  });

  it('sends a queued run and empties the queue', async () => {
    const { reporter, leaderboard } = setup();
    reporter.enqueue(good(4));
    expect(reporter.pending()).toBe(1);
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 1,
      rejected: 0,
      pending: 0,
    });
    expect(reporter.pending()).toBe(0);
    expect((await leaderboard.top(4, 10))[0]).toMatchObject({
      name: 'Ann',
      score: 510,
    });
  });

  it('sends several runs, one after another', async () => {
    const { reporter } = setup();
    [4, 5, 6].forEach(id => reporter.enqueue(good(id)));
    await expect(reporter.flush()).resolves.toMatchObject({
      accepted: 3,
      pending: 0,
    });
  });

  it('drops a run the server refuses, since sending it again cannot help', async () => {
    const { reporter, leaderboard } = setup();
    const forged: RunClaim = { ...good(4), score: 12345 };
    reporter.enqueue(forged);
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 0,
      rejected: 1,
      pending: 0,
    });
    await expect(leaderboard.top(4, 10)).resolves.toEqual([]);
  });

  it('a refused run does not hold up the good ones behind it', async () => {
    const { reporter } = setup();
    reporter.enqueue({ ...good(4), score: 1 });
    reporter.enqueue(good(5));
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 1,
      rejected: 1,
      pending: 0,
    });
  });
});

describe('RunReporter: when the network fails', () => {
  it('keeps the run and sends it on the next try', async () => {
    const { reporter, backend } = setup();
    reporter.enqueue(good(4));
    backend.offline = true;
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 0,
      rejected: 0,
      pending: 1,
    });
    expect(reporter.pending()).toBe(1);

    backend.offline = false;
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 1,
      rejected: 0,
      pending: 0,
    });
  });

  it('keeps the failed run and everything after it, but not what already went through', async () => {
    const backend = new InMemoryBackend(fixedSource(tinyLevel));
    const real = backend.client('ann').leaderboard;
    let calls = 0;
    const flaky: ILeaderboardService = {
      isAvailable: true,
      top: (l, n) => real.top(l, n),
      submit: (run): Promise<SubmitOutcome> => {
        calls++;
        return calls === 2
          ? Promise.reject(new Error('Network request failed'))
          : real.submit(run);
      },
    };
    time = 0;
    const reporter = new RunReporter({
      leaderboard: flaky,
      storage: new InMemoryStorage(),
      clock,
    });
    [4, 5, 6].forEach(id => reporter.enqueue(good(id)));
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 1,
      rejected: 0,
      pending: 2,
    });
    calls = 100; // the network is back
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 2,
      rejected: 0,
      pending: 0,
    });
  });

  it('does nothing while no leaderboard is connected, and keeps what is waiting', async () => {
    time = 0;
    const reporter = new RunReporter({
      leaderboard: new NoopLeaderboard(),
      storage: new InMemoryStorage(),
      clock,
    });
    reporter.enqueue(good(4));
    await expect(reporter.flush()).resolves.toEqual({
      accepted: 0,
      rejected: 0,
      pending: 1,
    });
  });

  it('concurrent flushes share one run (no double sending)', async () => {
    const { reporter, backend } = setup();
    reporter.enqueue(good(4));
    const [a, b] = await Promise.all([reporter.flush(), reporter.flush()]);
    expect(a).toEqual(b);
    expect(backend.calls.submit).toBe(1);
  });
});

describe('RunReporter: what it keeps', () => {
  it('keeps only the better run for a level', () => {
    const { reporter } = setup();
    reporter.enqueue(good(4));
    reporter.enqueue(slower(4)); // worse: ignored
    expect(reporter.pending()).toBe(1);
  });

  it('replaces a worse waiting run with a better one', async () => {
    const { reporter, leaderboard } = setup();
    reporter.enqueue(slower(4));
    reporter.enqueue(good(4));
    expect(reporter.pending()).toBe(1);
    await reporter.flush();
    expect((await leaderboard.top(4, 10))[0]?.score).toBe(510);
  });

  it('ignores an equal run rather than queueing it twice', () => {
    const { reporter } = setup();
    reporter.enqueue(good(4));
    reporter.enqueue(good(4));
    expect(reporter.pending()).toBe(1);
  });

  it('keeps runs for different levels apart', () => {
    const { reporter } = setup();
    reporter.enqueue(good(4));
    reporter.enqueue(good(5));
    expect(reporter.pending()).toBe(2);
  });

  it('never holds more than the limit, dropping the oldest', async () => {
    const { reporter, leaderboard } = setup(3);
    [4, 5, 6, 7, 8].forEach(id => reporter.enqueue(good(id)));
    expect(reporter.pending()).toBe(3);
    await reporter.flush();
    expect(await leaderboard.top(4, 5)).toHaveLength(0);
    expect(await leaderboard.top(5, 5)).toHaveLength(0);
    expect(await leaderboard.top(8, 5)).toHaveLength(1);
  });
});

describe('RunReporter: it survives the app closing', () => {
  it('a run queued offline is still there after a restart, and then goes out', async () => {
    const { reporter, storage, backend } = setup();
    backend.offline = true;
    reporter.enqueue(good(4));
    await reporter.flush();

    time = 100;
    const next = new RunReporter({
      leaderboard: backend.client('ann', 'Ann').leaderboard,
      storage,
      clock,
    });
    expect(next.pending()).toBe(1);
    backend.offline = false;
    await expect(next.flush()).resolves.toEqual({
      accepted: 1,
      rejected: 0,
      pending: 0,
    });
    expect(JSON.parse(storage.getString(KEY) as string).runs).toEqual([]);
  });

  it('stores the whole log with a version', () => {
    const { reporter, storage } = setup();
    reporter.enqueue(good(4));
    const saved = JSON.parse(storage.getString(KEY) as string);
    expect(saved.schemaVersion).toBe(1);
    expect(saved.runs[0].run.commands).toHaveLength(6);
  });

  it('starts empty when the stored queue is unreadable', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, '{broken');
    const reporter = new RunReporter({
      leaderboard: new NoopLeaderboard(),
      storage,
      clock,
    });
    expect(reporter.pending()).toBe(0);
  });

  it('starts empty when the stored queue is from a newer app', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, JSON.stringify({ schemaVersion: 9, runs: [] }));
    expect(
      new RunReporter({
        leaderboard: new NoopLeaderboard(),
        storage,
        clock,
      }).pending(),
    ).toBe(0);
  });

  it('skips a damaged entry but keeps the good ones', () => {
    const storage = new InMemoryStorage();
    const ok = { run: good(4), queuedAt: 1 };
    storage.setString(
      KEY,
      JSON.stringify({
        schemaVersion: 1,
        runs: [
          {
            run: { ...good(5), commands: [{ type: 'TELEPORT' }] },
            queuedAt: 2,
          },
          { run: { levelId: 'x' }, queuedAt: 3 },
          null,
          ok,
          { run: good(6) }, // no queuedAt
        ],
      }),
    );
    const reporter = new RunReporter({
      leaderboard: new NoopLeaderboard(),
      storage,
      clock,
    });
    expect(reporter.pending()).toBe(1);
  });

  it('starts empty when the runs field is missing', () => {
    const storage = new InMemoryStorage();
    storage.setString(KEY, JSON.stringify({ schemaVersion: 1 }));
    expect(
      new RunReporter({
        leaderboard: new NoopLeaderboard(),
        storage,
        clock,
      }).pending(),
    ).toBe(0);
  });
});
