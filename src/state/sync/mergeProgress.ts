import { mergeDailyRecords } from '../daily/dailyReward';
import {
  PROGRESS_SCHEMA_VERSION,
  canonicalJson,
} from '../persistence/progressDocument';
import type {
  LevelRecord,
  ProgressDocument,
} from '../persistence/progressDocument';

/**
 * Orders two documents by how recently their wallet and inventory were
 * changed. Ties are broken by coins and then by inventory contents, so the
 * outcome never depends on which document is passed first.
 */
function compareWallets(a: ProgressDocument, b: ProgressDocument): number {
  if (a.updatedAt !== b.updatedAt) {
    return a.updatedAt - b.updatedAt;
  }
  if (a.wallet.coins !== b.wallet.coins) {
    return a.wallet.coins - b.wallet.coins;
  }
  const ai = canonicalJson(a.inventory);
  const bi = canonicalJson(b.inventory);
  return ai === bi ? 0 : ai < bi ? -1 : 1;
}

/**
 * Combines two versions of one player's progress (GAME_DESIGN 13.6).
 *
 * - Achievements only ever go up: the higher unlocked level, and for every
 *   level the higher stars and the higher best score.
 * - The tutorial is done if it is done on either device.
 * - The daily-reward record with the more recent claim wins (see mergeDailyRecords).
 * - Wallet and inventory come, together, from the document changed more
 *   recently. Taking the larger amounts instead would let spent coins come
 *   back. (A transaction ledger, later, can replace this rule.)
 *
 * Commutative, associative and idempotent, so devices reach the same result
 * whatever order they sync in. Pure: neither input is changed.
 */
export function mergeProgress(
  a: ProgressDocument,
  b: ProgressDocument,
): ProgressDocument {
  const levels: Record<number, LevelRecord> = {};
  for (const source of [a.levels, b.levels]) {
    for (const [key, record] of Object.entries(source)) {
      const id = Number(key);
      const existing = levels[id];
      levels[id] = existing
        ? {
            stars: Math.max(existing.stars, record.stars),
            bestScore: Math.max(existing.bestScore, record.bestScore),
          }
        : { stars: record.stars, bestScore: record.bestScore };
    }
  }

  const newer = compareWallets(a, b) >= 0 ? a : b;
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    highestUnlockedLevel: Math.max(
      a.highestUnlockedLevel,
      b.highestUnlockedLevel,
    ),
    levels,
    wallet: { coins: newer.wallet.coins },
    inventory: { ...newer.inventory },
    tutorialCompleted: a.tutorialCompleted || b.tutorialCompleted,
    dailyReward: mergeDailyRecords(a.dailyReward, b.dailyReward),
  };
}

/** True if two documents have exactly the same content. */
export function sameProgress(
  a: ProgressDocument,
  b: ProgressDocument,
): boolean {
  return canonicalJson(a) === canonicalJson(b);
}
