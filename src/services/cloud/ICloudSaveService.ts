/** What the cloud holds for one player: an opaque piece of text and its revision. */
export interface CloudSnapshot {
  readonly payload: string;
  /** Changes every time the stored payload changes. Compared, never interpreted. */
  readonly revision: string;
}

export type PushResult =
  | { readonly ok: true; readonly revision: string }
  /**
   * Someone else saved since the revision we started from. The current
   * snapshot comes back so the caller can merge it and try again at once.
   */
  | {
      readonly ok: false;
      readonly reason: 'conflict';
      readonly current: CloudSnapshot;
    };

/**
 * Stores one player's progress in the cloud. The service knows nothing about
 * the game: it keeps text and a revision. A real provider (Firebase, PlayFab,
 * Supabase, a custom server) only has to implement these two calls.
 *
 * Network failures reject the promise; the caller treats that as "offline".
 */
export interface ICloudSaveService {
  /** False for the placeholder used until a provider is connected. */
  readonly isAvailable: boolean;

  /** The stored snapshot, or null if this player has none yet. */
  pull(): Promise<CloudSnapshot | null>;

  /**
   * Replaces the stored payload, but only if `baseRevision` is still the
   * current revision (null means "nothing stored yet"). This is what stops two
   * devices from silently overwriting each other.
   */
  push(payload: string, baseRevision: string | null): Promise<PushResult>;
}
