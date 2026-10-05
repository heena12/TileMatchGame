/** Single owner of persisted key names. Stored documents carry their own schemaVersion. */
export const STORAGE_KEYS = {
  playerProgress: 'player.progress',
  /** Copy of an unreadable progress document, kept before it is overwritten. */
  playerProgressBackup: 'player.progress.backup',
  settings: 'player.settings',
  /** The level being played right now (device-local, never synced). */
  inProgressGame: 'game.inProgress',
  /** Finished runs waiting to be sent to the leaderboard. */
  leaderboardQueue: 'leaderboard.queue',
  /** Set once the system notification prompt has been shown. */
  notificationPrompted: 'notifications.prompted',
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
