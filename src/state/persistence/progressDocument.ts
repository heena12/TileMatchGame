/** Current shape of the saved progress document (GAME_DESIGN 13.6). */
import type { DailyRewardRecord } from '../daily/dailyReward';

export const PROGRESS_SCHEMA_VERSION = 3;

export interface LevelRecord {
  readonly stars: number;
  readonly bestScore: number;
}

/** Booster counts by name. */
export type Inventory = Readonly<Record<string, number>>;

/**
 * The player's progress exactly as it is stored on the device and in the
 * cloud. Plain data, so it can be merged, compared and sent as text.
 */
export interface ProgressDocument {
  readonly schemaVersion: number;
  readonly updatedAt: number;
  readonly highestUnlockedLevel: number;
  /** Sparse: only levels that were cleared. */
  readonly levels: Readonly<Record<number, LevelRecord>>;
  readonly wallet: { readonly coins: number };
  readonly inventory: Inventory;
  readonly tutorialCompleted: boolean;
  readonly dailyReward: DailyRewardRecord;
}

/**
 * JSON with object keys in sorted order, so two documents with the same
 * content give the same text whatever order their fields were built in.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v).sort()) {
        sorted[key] = (v as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return v;
  });
}
