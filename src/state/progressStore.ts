import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { IClock } from '@engine';
import { BOOSTER_PRICES, STARTER_BOOSTERS } from '@config/boosters';
import type { BoosterKind } from '@config/boosters';
import { APP_CONFIG } from '@config/constants';
import type { IStorage } from '@services/storage/IStorage';
import { STORAGE_KEYS } from '@services/storage/keys';
import { readVersioned } from './persistence/migrations';
import { PROGRESS_SCHEMA_VERSION } from './persistence/progressDocument';
import type {
  Inventory,
  LevelRecord,
  ProgressDocument,
} from './persistence/progressDocument';
import {
  EMPTY_DAILY_RECORD,
  claimDaily,
  sanitizeDailyRecord,
} from './daily/dailyReward';
import type { DailyRewardRecord } from './daily/dailyReward';
import { mergeProgress, sameProgress } from './sync/mergeProgress';
import type { Doc, MigrationStep } from './persistence/migrations';

// The document shape lives in its own module so the merge code can share it.
export { PROGRESS_SCHEMA_VERSION };
export type { Inventory, LevelRecord, ProgressDocument };

export interface LevelResult {
  readonly levelId: number;
  readonly stars: number;
  readonly score: number;
  /** Coins earned this run (already computed by the reward rules). */
  readonly coins: number;
}

/**
 * Anything that can be handed to the player: coins, boosters, or both. Rewarded
 * ads and in-app purchases only ever call `credit` with one of these, so the
 * game rules never know where a reward came from.
 */
export interface WalletGrant {
  readonly coins?: number;
  readonly boosters?: Readonly<Partial<Record<BoosterKind, number>>>;
}

/** How a booster use was paid for. */
export type PaymentMethod = 'inventory' | 'coins';

/** What happened when the saved document was read at start-up. */
export type LoadIssue = 'none' | 'corrupt' | 'future';

export interface ProgressState {
  readonly highestUnlockedLevel: number;
  /** Sparse: only levels that were cleared. */
  readonly levels: Readonly<Record<number, LevelRecord>>;
  readonly coins: number;
  readonly inventory: Inventory;
  /** True once the guided levels are finished or skipped. */
  readonly tutorialCompleted: boolean;
  readonly updatedAt: number;
  /** Last daily-reward claim and the streak. Part of the saved and cloud document. */
  readonly dailyReward: DailyRewardRecord;
  /** Set when the stored document could not be used; defaults are in effect. */
  readonly loadIssue: LoadIssue;
  recordResult(result: LevelResult): void;
  completeTutorial(): void;
  /**
   * Claims today's daily reward: credits it, extends the streak and saves,
   * all together. Returns the reward, or null if today's is already claimed.
   */
  claimDailyReward(): WalletGrant | null;
  /** Adds coins and/or boosters. Negative or fractional amounts are ignored. */
  credit(grant: WalletGrant): void;
  /**
   * Shop purchase: spends the booster's price in coins and adds one to the
   * stock. Returns false (and changes nothing) if the coins are not there.
   */
  buyBooster(kind: BoosterKind): boolean;
  /** Spends coins (a revive). False, and nothing changes, if there are too few. */
  spendCoins(amount: number): boolean;
  /** True if one use of `kind` can be paid for: in stock, or enough coins. */
  canAfford(kind: BoosterKind): boolean;
  /**
   * Pays for one use: takes one from stock if there is any, otherwise spends
   * the price in coins. Returns how it was paid, or null (and changes nothing)
   * if the player can afford neither.
   */
  payForBooster(kind: BoosterKind): PaymentMethod | null;
  /** The whole progress as it is stored and sent to the cloud. */
  exportDocument(): ProgressDocument;
  /**
   * Merges progress that came from the cloud into this device (rules in
   * mergeProgress) and saves the result. Returns true if anything changed.
   */
  mergeRemote(remote: ProgressDocument): boolean;
}

export type ProgressStore = StoreApi<ProgressState>;

type Snapshot = Omit<
  ProgressState,
  | 'recordResult'
  | 'completeTutorial'
  | 'claimDailyReward'
  | 'credit'
  | 'buyBooster'
  | 'spendCoins'
  | 'canAfford'
  | 'payForBooster'
  | 'exportDocument'
  | 'mergeRemote'
  | 'loadIssue'
>;

const isCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0;

function defaults(): Snapshot {
  return {
    highestUnlockedLevel: 1,
    levels: {},
    coins: 0,
    inventory: {},
    updatedAt: 0,
    tutorialCompleted: false,
    dailyReward: EMPTY_DAILY_RECORD,
  };
}

/**
 * Version 1 -> 2: `coins` moves into `wallet`, `inventory` appears (empty),
 * and the tutorial flag is settled: a save already past the guided levels
 * counts as finished.
 */
const v1ToV2: MigrationStep = (doc: Doc): Doc => {
  const { coins, ...rest } = doc;
  const highest = doc.highestUnlockedLevel;
  return {
    ...rest,
    wallet: { coins: isCount(coins) ? coins : 0 },
    inventory: {},
    tutorialCompleted:
      doc.tutorialCompleted === true ||
      (typeof highest === 'number' && highest > APP_CONFIG.tutorialLevels),
  };
};

/** Version 2 -> 3: the daily-reward record appears, empty. */
const v2ToV3: MigrationStep = (doc: Doc): Doc => ({
  ...doc,
  dailyReward: { lastClaimDay: null, streak: 0 },
});

const MIGRATIONS: Readonly<Record<number, MigrationStep>> = {
  1: v1ToV2,
  2: v2ToV3,
};

/** Field-by-field cleanup of a current-version document. A bad field gets its default. */
function sanitize(doc: Doc): Snapshot {
  const levels: Record<number, LevelRecord> = {};
  const rawLevels = doc.levels;
  if (typeof rawLevels === 'object' && rawLevels !== null) {
    for (const [key, value] of Object.entries(rawLevels)) {
      const id = Number(key);
      const rec = value as Partial<LevelRecord> | null;
      if (
        Number.isInteger(id) &&
        id >= 1 &&
        rec &&
        isCount(rec.stars) &&
        isCount(rec.bestScore)
      ) {
        levels[id] = { stars: rec.stars, bestScore: rec.bestScore };
      }
    }
  }

  const inventory: Record<string, number> = {};
  const rawInventory = doc.inventory;
  if (typeof rawInventory === 'object' && rawInventory !== null) {
    for (const [name, count] of Object.entries(rawInventory)) {
      if (isCount(count) && Number.isInteger(count)) {
        inventory[name] = count;
      }
    }
  }

  const wallet = doc.wallet as { coins?: unknown } | null | undefined;
  const highest = doc.highestUnlockedLevel;
  return {
    highestUnlockedLevel:
      isCount(highest) && Number.isInteger(highest) && highest >= 1
        ? highest
        : 1,
    levels,
    coins: isCount(wallet?.coins) ? wallet.coins : 0,
    inventory,
    updatedAt: isCount(doc.updatedAt) ? doc.updatedAt : 0,
    tutorialCompleted: doc.tutorialCompleted === true,
    dailyReward: sanitizeDailyRecord(doc.dailyReward),
  };
}

interface Loaded {
  snapshot: Snapshot;
  issue: LoadIssue;
  /** The unreadable text, if any, so it can be backed up before being overwritten. */
  unreadableRaw: string | undefined;
}

/** Reading never writes: unreadable data is left exactly as it was until the next save. */
function load(storage: IStorage): Loaded {
  const raw = storage.getString(STORAGE_KEYS.playerProgress);
  const outcome = readVersioned(raw, PROGRESS_SCHEMA_VERSION, MIGRATIONS);
  switch (outcome.kind) {
    case 'ok':
      return {
        snapshot: sanitize(outcome.doc),
        issue: 'none',
        unreadableRaw: undefined,
      };
    case 'corrupt':
      return { snapshot: defaults(), issue: 'corrupt', unreadableRaw: raw };
    case 'future':
      return { snapshot: defaults(), issue: 'future', unreadableRaw: raw };
    default:
      return { snapshot: defaults(), issue: 'none', unreadableRaw: undefined };
  }
}

function toDocument(s: Snapshot): ProgressDocument {
  return {
    schemaVersion: PROGRESS_SCHEMA_VERSION,
    updatedAt: s.updatedAt,
    highestUnlockedLevel: s.highestUnlockedLevel,
    levels: s.levels,
    wallet: { coins: s.coins },
    inventory: s.inventory,
    tutorialCompleted: s.tutorialCompleted,
    dailyReward: s.dailyReward,
  };
}

function fromDocument(d: ProgressDocument): Snapshot {
  return {
    highestUnlockedLevel: d.highestUnlockedLevel,
    levels: d.levels,
    coins: d.wallet.coins,
    inventory: d.inventory,
    updatedAt: d.updatedAt,
    tutorialCompleted: d.tutorialCompleted,
    dailyReward: d.dailyReward,
  };
}

/** What reading a stored or downloaded progress document gave. */
export type ProgressRead =
  | { readonly kind: 'ok'; readonly doc: ProgressDocument }
  | { readonly kind: 'none' }
  | { readonly kind: 'corrupt' }
  /** Written by a newer version of the app. */
  | { readonly kind: 'future' };

/**
 * Reads progress text from anywhere - the device or the cloud - with the same
 * version check, migrations and field-by-field cleanup. Never trusts its input.
 */
export function readProgressDocument(raw: string | undefined): ProgressRead {
  const outcome = readVersioned(raw, PROGRESS_SCHEMA_VERSION, MIGRATIONS);
  switch (outcome.kind) {
    case 'ok':
      return { kind: 'ok', doc: toDocument(sanitize(outcome.doc)) };
    case 'corrupt':
      return { kind: 'corrupt' };
    case 'future':
      return { kind: 'future' };
    default:
      return { kind: 'none' };
  }
}

/**
 * Marks the tutorial done (when `done`) and, the first time only, hands out the
 * starter boosters so a new player has tried each one.
 */
function finishTutorialIf(
  state: { tutorialCompleted: boolean; inventory: Inventory },
  done: boolean,
): { tutorialCompleted: boolean; inventory: Inventory } {
  if (state.tutorialCompleted || !done) {
    return {
      tutorialCompleted: state.tutorialCompleted,
      inventory: state.inventory,
    };
  }
  return {
    tutorialCompleted: true,
    inventory: addToInventory(state.inventory, STARTER_BOOSTERS),
  };
}

const isWholeCount = (v: unknown): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v > 0;

function addToInventory(
  inventory: Inventory,
  extra: Readonly<Partial<Record<string, number>>>,
): Inventory {
  const next: Record<string, number> = { ...inventory };
  for (const [name, amount] of Object.entries(extra)) {
    if (isWholeCount(amount)) {
      next[name] = (next[name] ?? 0) + amount;
    }
  }
  return next;
}

/** Storage and clock are injected so tests use fakes. Cloud merge comes in Phase 11. */
export function createProgressStore(
  storage: IStorage,
  clock: IClock,
): ProgressStore {
  const loaded = load(storage);
  // Copy unreadable data aside before the first save replaces it.
  let pendingBackup = loaded.unreadableRaw;

  return createStore<ProgressState>((set, get) => {
    const current = (): Snapshot => {
      const s = get();
      return {
        highestUnlockedLevel: s.highestUnlockedLevel,
        levels: s.levels,
        coins: s.coins,
        inventory: s.inventory,
        updatedAt: s.updatedAt,
        tutorialCompleted: s.tutorialCompleted,
        dailyReward: s.dailyReward,
      };
    };

    const save = (next: Snapshot) => {
      if (pendingBackup !== undefined) {
        storage.setString(STORAGE_KEYS.playerProgressBackup, pendingBackup);
        pendingBackup = undefined;
      }
      const data = toDocument(next);
      storage.setString(STORAGE_KEYS.playerProgress, JSON.stringify(data));
      set(next);
    };

    return {
      ...loaded.snapshot,
      loadIssue: loaded.issue,
      recordResult: ({ levelId, stars, score, coins }) => {
        const state = current();
        const previous = state.levels[levelId];
        save({
          ...state,
          updatedAt: clock.now(),
          highestUnlockedLevel: Math.max(
            state.highestUnlockedLevel,
            levelId + 1,
          ),
          coins: state.coins + coins,
          levels: {
            ...state.levels,
            [levelId]: {
              stars: Math.max(previous?.stars ?? 0, stars),
              bestScore: Math.max(previous?.bestScore ?? 0, score),
            },
          },
          ...finishTutorialIf(state, levelId >= APP_CONFIG.tutorialLevels),
        });
      },
      completeTutorial: () => {
        const state = current();
        if (state.tutorialCompleted) {
          return;
        }
        save({
          ...state,
          updatedAt: clock.now(),
          ...finishTutorialIf(state, true),
        });
      },
      claimDailyReward: () => {
        const state = current();
        const claimed = claimDaily(state.dailyReward, clock.now());
        if (!claimed) {
          return null;
        }
        const reward = claimed.reward;
        save({
          ...state,
          updatedAt: clock.now(),
          coins: state.coins + (isWholeCount(reward.coins) ? reward.coins : 0),
          inventory: addToInventory(state.inventory, reward.boosters ?? {}),
          dailyReward: claimed.record,
        });
        return reward;
      },
      credit: grant => {
        const state = current();
        const coins = isWholeCount(grant.coins) ? grant.coins : 0;
        const boosters = grant.boosters ?? {};
        if (
          coins === 0 &&
          Object.keys(addToInventory({}, boosters)).length === 0
        ) {
          return;
        }
        save({
          ...state,
          updatedAt: clock.now(),
          coins: state.coins + coins,
          inventory: addToInventory(state.inventory, boosters),
        });
      },
      spendCoins: amount => {
        const state = current();
        if (!isWholeCount(amount) || state.coins < amount) {
          return false;
        }
        save({
          ...state,
          updatedAt: clock.now(),
          coins: state.coins - amount,
        });
        return true;
      },
      buyBooster: kind => {
        const state = current();
        const price = BOOSTER_PRICES[kind];
        if (state.coins < price) {
          return false;
        }
        save({
          ...state,
          updatedAt: clock.now(),
          coins: state.coins - price,
          inventory: addToInventory(state.inventory, { [kind]: 1 }),
        });
        return true;
      },
      canAfford: kind => {
        const state = get();
        return (
          (state.inventory[kind] ?? 0) > 0 ||
          state.coins >= BOOSTER_PRICES[kind]
        );
      },
      payForBooster: kind => {
        const state = current();
        const stock = state.inventory[kind] ?? 0;
        if (stock > 0) {
          save({
            ...state,
            updatedAt: clock.now(),
            inventory: { ...state.inventory, [kind]: stock - 1 },
          });
          return 'inventory';
        }
        const price = BOOSTER_PRICES[kind];
        if (state.coins >= price) {
          save({
            ...state,
            updatedAt: clock.now(),
            coins: state.coins - price,
          });
          return 'coins';
        }
        return null;
      },
      exportDocument: () => toDocument(current()),
      mergeRemote: remote => {
        const local = toDocument(current());
        const merged = mergeProgress(local, remote);
        if (sameProgress(merged, local)) {
          return false;
        }
        // Keep the merged timestamp: a merge is not something the player did.
        save(fromDocument(merged));
        return true;
      },
    };
  });
}
