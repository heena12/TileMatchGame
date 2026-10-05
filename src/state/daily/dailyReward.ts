import { DAILY_REWARDS, DAILY_REWARD_CYCLE } from '@config/dailyReward';
import type { WalletGrant } from '@state/progressStore';

/** What is persisted: the last day a reward was claimed, and the run of days so far. */
export interface DailyRewardRecord {
  /** Calendar day number (see dayNumber) of the last claim, or null if never. */
  readonly lastClaimDay: number | null;
  /** Consecutive days claimed, ending at lastClaimDay. */
  readonly streak: number;
}

export const EMPTY_DAILY_RECORD: DailyRewardRecord = {
  lastClaimDay: null,
  streak: 0,
};

export interface DailyRewardStatus {
  /** True if a reward can be claimed right now. */
  readonly available: boolean;
  /** Which day of the cycle (1..DAILY_REWARD_CYCLE) the next, or today's claimed, reward is. */
  readonly cycleDay: number;
  /** Streak the player would have after claiming (or has, if already claimed). */
  readonly streak: number;
  readonly reward: WalletGrant;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Local calendar day as a whole number. Built from the local date parts, so
 * midnight is the player's midnight and daylight-saving shifts cannot skip or
 * repeat a day.
 */
export function dayNumber(timestamp: number): number {
  const d = new Date(timestamp);
  return Math.floor(
    Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / MS_PER_DAY,
  );
}

function rewardFor(cycleDay: number): WalletGrant {
  return DAILY_REWARDS[cycleDay - 1] ?? {};
}

/** Pure: where the player stands on `now`. */
export function evaluateDaily(
  record: DailyRewardRecord,
  now: number,
): DailyRewardStatus {
  const today = dayNumber(now);
  const { lastClaimDay, streak } = record;
  if (
    lastClaimDay === null ||
    today - lastClaimDay > 1 ||
    today < lastClaimDay
  ) {
    // First claim, a missed day, or a clock set back: start again at day 1.
    return { available: true, cycleDay: 1, streak: 1, reward: rewardFor(1) };
  }
  if (today === lastClaimDay) {
    const cycleDay = ((streak - 1) % DAILY_REWARD_CYCLE) + 1;
    return { available: false, cycleDay, streak, reward: rewardFor(cycleDay) };
  }
  const next = streak + 1;
  const cycleDay = ((next - 1) % DAILY_REWARD_CYCLE) + 1;
  return {
    available: true,
    cycleDay,
    streak: next,
    reward: rewardFor(cycleDay),
  };
}

/** Pure: the record after claiming on `now`, or null if nothing is claimable. */
export function claimDaily(
  record: DailyRewardRecord,
  now: number,
): { record: DailyRewardRecord; reward: WalletGrant } | null {
  const status = evaluateDaily(record, now);
  if (!status.available) {
    return null;
  }
  return {
    record: { lastClaimDay: dayNumber(now), streak: status.streak },
    reward: status.reward,
  };
}

/** Cleans a stored or downloaded record. Anything unusable becomes "never claimed". */
export function sanitizeDailyRecord(raw: unknown): DailyRewardRecord {
  const data = raw as { lastClaimDay?: unknown; streak?: unknown } | null;
  const day = data?.lastClaimDay;
  const streak = data?.streak;
  if (
    typeof day === 'number' &&
    Number.isInteger(day) &&
    typeof streak === 'number' &&
    Number.isInteger(streak) &&
    streak >= 1
  ) {
    return { lastClaimDay: day, streak };
  }
  return EMPTY_DAILY_RECORD;
}

/**
 * Combines two devices' records: the more recent claim wins, and on the same
 * day the longer streak. Commutative, associative and idempotent.
 */
export function mergeDailyRecords(
  a: DailyRewardRecord,
  b: DailyRewardRecord,
): DailyRewardRecord {
  if (a.lastClaimDay === null) {
    return b;
  }
  if (b.lastClaimDay === null) {
    return a;
  }
  if (a.lastClaimDay !== b.lastClaimDay) {
    return a.lastClaimDay > b.lastClaimDay ? a : b;
  }
  return a.streak >= b.streak ? a : b;
}
