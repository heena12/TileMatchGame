import type { IClock } from '@engine';
import type { ICloudSaveService } from '@services/cloud/ICloudSaveService';
import { readProgressDocument } from '../progressStore';
import type { ProgressStore } from '../progressStore';
import type { ProgressDocument } from '../persistence/progressDocument';
import { canonicalJson } from '../persistence/progressDocument';
import type { SyncStatus, SyncStore } from './syncStore';

/** True if the stored text, read as data, is exactly this document. */
function cloudHolds(payload: string, local: ProgressDocument): boolean {
  try {
    return canonicalJson(JSON.parse(payload)) === canonicalJson(local);
  } catch {
    return false;
  }
}

export interface SyncDeps {
  cloud: ICloudSaveService;
  progress: ProgressStore;
  store: SyncStore;
  clock: IClock;
  /** Wait this long after the last change before syncing, so a burst is one sync. */
  debounceMs?: number;
  /** Give up after this many conflicts in a row. */
  maxAttempts?: number;
}

const DEFAULT_DEBOUNCE_MS = 2000;
const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * Keeps this device's progress and the cloud copy in step.
 *
 * pull -> merge into this device -> push the merged result (naming the
 * revision we pulled). If someone else saved in between, the cloud says so,
 * hands back what it has now, and we merge and try again. Nothing is ever
 * overwritten blindly, and nothing is pushed when there is nothing new.
 */
export class SyncService {
  private running: Promise<SyncStatus> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  /** True while a merge that came FROM the cloud is being applied. */
  private applyingRemote = false;
  /** Set when progress changed during a sync, so the change is not missed. */
  private changedWhileRunning = false;

  constructor(private readonly deps: SyncDeps) {}

  get isAvailable(): boolean {
    return this.deps.cloud.isAvailable;
  }

  /**
   * Starts syncing: once now, and again shortly after each change to progress.
   * Returns a function that stops it.
   */
  start(): () => void {
    const { cloud, progress, store } = this.deps;
    if (!cloud.isAvailable) {
      store.getState().set({ status: 'unavailable' });
      return () => undefined;
    }
    store.getState().set({ status: 'idle' });

    const unsubscribe = progress.subscribe(() => {
      if (this.applyingRemote) {
        return; // our own merge; nothing new to send
      }
      if (this.running) {
        this.changedWhileRunning = true;
      } else {
        this.schedule();
      }
    });
    this.syncNow().catch(() => undefined);

    return () => {
      unsubscribe();
      this.cancelTimer();
    };
  }

  /** Runs a sync now. Calls made while one is running share it. */
  syncNow(): Promise<SyncStatus> {
    if (!this.deps.cloud.isAvailable) {
      this.deps.store.getState().set({ status: 'unavailable' });
      return Promise.resolve('unavailable');
    }
    if (this.running) {
      return this.running;
    }
    this.cancelTimer();
    this.running = this.run().finally(() => {
      this.running = null;
      if (this.changedWhileRunning) {
        this.changedWhileRunning = false;
        this.schedule();
      }
    });
    return this.running;
  }

  private schedule(): void {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      this.syncNow().catch(() => undefined);
    }, this.deps.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private finish(status: SyncStatus): SyncStatus {
    const changes =
      status === 'synced'
        ? { status, lastSyncedAt: this.deps.clock.now() }
        : { status };
    this.deps.store.getState().set(changes);
    return status;
  }

  private async run(): Promise<SyncStatus> {
    const { cloud, progress, store } = this.deps;
    const maxAttempts = this.deps.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
    store.getState().set({ status: 'syncing' });

    try {
      let snapshot = await cloud.pull();

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        let remote: ProgressDocument | null = null;
        if (snapshot) {
          const read = readProgressDocument(snapshot.payload);
          if (read.kind === 'future') {
            return this.finish('update_required');
          }
          if (read.kind === 'corrupt') {
            // Never overwrite something we cannot read.
            return this.finish('error');
          }
          remote = read.kind === 'ok' ? read.doc : null;
        }

        if (remote) {
          this.applyingRemote = true;
          try {
            progress.getState().mergeRemote(remote);
          } finally {
            this.applyingRemote = false;
          }
        }

        const local = progress.getState().exportDocument();
        // Nothing to send if the cloud already holds exactly this document. A copy
        // in an older format has the same content but different text, so it is
        // pushed once and the cloud is brought up to the current format.
        if (snapshot && remote && cloudHolds(snapshot.payload, local)) {
          return this.finish('synced');
        }

        const result = await cloud.push(
          JSON.stringify(local),
          snapshot?.revision ?? null,
        );
        if (result.ok) {
          return this.finish('synced');
        }
        snapshot = result.current; // someone got there first: merge theirs and retry
      }
      return this.finish('error');
    } catch {
      return this.finish('offline');
    }
  }
}
