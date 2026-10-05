import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

/**
 * - `unavailable`: no cloud provider is connected.
 * - `idle`: connected, nothing has happened yet.
 * - `syncing`: a sync is running.
 * - `synced`: the last sync finished; this device and the cloud agree.
 * - `offline`: the last attempt could not reach the cloud; it will retry.
 * - `update_required`: the cloud copy was written by a newer app; nothing was touched.
 * - `error`: the cloud copy is unreadable or kept changing; nothing was overwritten.
 */
export type SyncStatus =
  | 'unavailable'
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'update_required'
  | 'error';

export interface SyncData {
  readonly status: SyncStatus;
  /** Clock time of the last successful sync, or null if there has not been one. */
  readonly lastSyncedAt: number | null;
}

export interface SyncState extends SyncData {
  set(changes: Partial<SyncData>): void;
}

export type SyncStore = StoreApi<SyncState>;

export function createSyncStore(initial: SyncStatus): SyncStore {
  return createStore<SyncState>(set => ({
    status: initial,
    lastSyncedAt: null,
    set: changes => set(changes),
  }));
}
