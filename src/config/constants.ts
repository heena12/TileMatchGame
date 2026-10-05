export const APP_CONFIG = {
  storageId: 'tile-match',
  /** Shown in Settings > About. Keep in step with package.json. */
  appVersion: '0.0.1',
  supportEmail: 'support@sofscript.com',
  /** Brand screen alone, then the loading screen until splashDurationMs. */
  splashBrandMs: 1400,
  splashDurationMs: 3800,
  /** Levels shown on the map. The generator can go beyond this. */
  maxLevels: 10000,
  levelMapColumns: 5,
  /** Levels 1..N are the guided tutorial. */
  tutorialLevels: 10,
} as const;
