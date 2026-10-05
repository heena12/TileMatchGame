import type { IClock, RunClaim } from '@engine';
import type { ILeaderboardService } from '@services/leaderboard/ILeaderboardService';
import type { IStorage } from '@services/storage/IStorage';
import { STORAGE_KEYS } from '@services/storage/keys';
import { readVersioned } from '../persistence/migrations';
import { parseCommands } from '../savedGameStore';

const QUEUE_SCHEMA_VERSION = 1;
const DEFAULT_MAX_QUEUED = 50;

interface QueuedRun {
  readonly run: RunClaim;
  readonly queuedAt: number;
}

export interface FlushResult {
  /** Runs the server accepted. */
  readonly accepted: number;
  /** Runs the server refused; they are dropped because sending again cannot help. */
  readonly rejected: number;
  /** Runs still waiting (for example because the network was down). */
  readonly pending: number;
}

export interface RunReporterDeps {
  leaderboard: ILeaderboardService;
  storage: IStorage;
  clock: IClock;
  maxQueued?: number;
}

function parseQueue(raw: string | undefined): QueuedRun[] {
  const outcome = readVersioned(raw, QUEUE_SCHEMA_VERSION, {});
  if (outcome.kind !== 'ok' || !Array.isArray(outcome.doc.runs)) {
    return [];
  }
  const queue: QueuedRun[] = [];
  for (const item of outcome.doc.runs) {
    const entry = item as Partial<{
      run: Partial<RunClaim>;
      queuedAt: unknown;
    }> | null;
    const run = entry?.run;
    const commands = parseCommands(run?.commands);
    if (
      !run ||
      commands === null ||
      typeof run.levelId !== 'number' ||
      !Number.isInteger(run.levelId) ||
      typeof run.levelContentVersion !== 'string' ||
      typeof run.score !== 'number' ||
      typeof run.stars !== 'number' ||
      typeof entry?.queuedAt !== 'number'
    ) {
      continue; // skip a damaged entry, keep the rest
    }
    queue.push({
      run: {
        levelId: run.levelId,
        levelContentVersion: run.levelContentVersion,
        commands,
        score: run.score,
        stars: run.stars,
      },
      queuedAt: entry.queuedAt,
    });
  }
  return queue;
}

/**
 * Holds finished runs until the leaderboard can take them. The queue is saved
 * on the device, so a run played offline (or just before the app closed) is not
 * lost. Only the best run per level is kept, and at most `maxQueued` overall.
 */
export class RunReporter {
  private queue: QueuedRun[];
  private flushing: Promise<FlushResult> | null = null;

  constructor(private readonly deps: RunReporterDeps) {
    this.queue = parseQueue(
      deps.storage.getString(STORAGE_KEYS.leaderboardQueue),
    );
  }

  pending(): number {
    return this.queue.length;
  }

  /** Adds a run to send later. A worse run on a level already waiting is ignored. */
  enqueue(run: RunClaim): void {
    const waiting = this.queue.find(q => q.run.levelId === run.levelId);
    if (waiting && waiting.run.score >= run.score) {
      return;
    }
    this.queue = this.queue.filter(q => q.run.levelId !== run.levelId);
    this.queue.push({ run, queuedAt: this.deps.clock.now() });

    const max = this.deps.maxQueued ?? DEFAULT_MAX_QUEUED;
    while (this.queue.length > max) {
      // Drop the oldest waiting run.
      const oldest = this.queue.reduce((a, b) =>
        b.queuedAt < a.queuedAt ? b : a,
      );
      this.queue = this.queue.filter(q => q !== oldest);
    }
    this.persist();
  }

  /** Sends everything that is waiting, one run at a time. Calls made meanwhile share it. */
  flush(): Promise<FlushResult> {
    if (this.flushing) {
      return this.flushing;
    }
    this.flushing = this.sendAll().finally(() => {
      this.flushing = null;
    });
    return this.flushing;
  }

  private async sendAll(): Promise<FlushResult> {
    let accepted = 0;
    let rejected = 0;
    if (this.deps.leaderboard.isAvailable) {
      for (const item of [...this.queue]) {
        try {
          const outcome = await this.deps.leaderboard.submit(item.run);
          outcome.status === 'accepted' ? accepted++ : rejected++;
          this.queue = this.queue.filter(q => q !== item);
          this.persist();
        } catch {
          break; // network trouble: keep this run and everything after it
        }
      }
    }
    return { accepted, rejected, pending: this.queue.length };
  }

  private persist(): void {
    this.deps.storage.setString(
      STORAGE_KEYS.leaderboardQueue,
      JSON.stringify({ schemaVersion: QUEUE_SCHEMA_VERSION, runs: this.queue }),
    );
  }
}
