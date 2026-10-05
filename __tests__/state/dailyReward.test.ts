import { DAILY_REWARDS, DAILY_REWARD_CYCLE } from '@config/dailyReward';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import {
  EMPTY_DAILY_RECORD,
  claimDaily,
  dayNumber,
  evaluateDaily,
  mergeDailyRecords,
} from '@state/daily/dailyReward';
import { createProgressStore } from '@state/progressStore';

const at = (offsetDays: number, hour = 12) =>
  new Date(2026, 2, 8 + offsetDays, hour).getTime();

describe('dayNumber', () => {
  it('is the same all day and one higher the next day', () => {
    expect(dayNumber(at(0, 0))).toBe(dayNumber(at(0, 23)));
    expect(dayNumber(at(1, 0))).toBe(dayNumber(at(0, 0)) + 1);
  });

  it('counts consecutive days across a month boundary', () => {
    const a = new Date(2026, 0, 31, 23).getTime();
    const b = new Date(2026, 1, 1, 1).getTime();
    expect(dayNumber(b) - dayNumber(a)).toBe(1);
  });
});

describe('evaluateDaily / claimDaily', () => {
  it('offers day 1 to a new player', () => {
    const s = evaluateDaily(EMPTY_DAILY_RECORD, at(0));
    expect(s).toMatchObject({ available: true, cycleDay: 1, streak: 1 });
    expect(s.reward).toEqual(DAILY_REWARDS[0]);
  });

  it('cannot be claimed twice on the same day', () => {
    const first = claimDaily(EMPTY_DAILY_RECORD, at(0, 8));
    expect(first).not.toBeNull();
    const record = first?.record ?? EMPTY_DAILY_RECORD;
    expect(claimDaily(record, at(0, 22))).toBeNull();
    expect(evaluateDaily(record, at(0, 22)).available).toBe(false);
  });

  it('continues the streak on the next day', () => {
    let record = claimDaily(EMPTY_DAILY_RECORD, at(0))?.record;
    record = claimDaily(record ?? EMPTY_DAILY_RECORD, at(1))?.record;
    expect(record?.streak).toBe(2);
    expect(evaluateDaily(record ?? EMPTY_DAILY_RECORD, at(2))).toMatchObject({
      available: true,
      cycleDay: 3,
      streak: 3,
    });
  });

  it('resets to day 1 after a missed day', () => {
    let record = claimDaily(EMPTY_DAILY_RECORD, at(0))?.record;
    record = claimDaily(record ?? EMPTY_DAILY_RECORD, at(1))?.record;
    expect(evaluateDaily(record ?? EMPTY_DAILY_RECORD, at(3))).toMatchObject({
      available: true,
      cycleDay: 1,
      streak: 1,
    });
  });

  it('loops back to day 1 after the last day of the cycle', () => {
    let record = EMPTY_DAILY_RECORD;
    for (let i = 0; i < DAILY_REWARD_CYCLE; i++) {
      record = claimDaily(record, at(i))?.record ?? record;
    }
    expect(record.streak).toBe(DAILY_REWARD_CYCLE);
    const next = evaluateDaily(record, at(DAILY_REWARD_CYCLE));
    expect(next.cycleDay).toBe(1);
    expect(next.streak).toBe(DAILY_REWARD_CYCLE + 1);
    expect(next.reward).toEqual(DAILY_REWARDS[0]);
  });

  it('restarts when the clock is set back', () => {
    const record = claimDaily(EMPTY_DAILY_RECORD, at(5))?.record;
    expect(evaluateDaily(record ?? EMPTY_DAILY_RECORD, at(0))).toMatchObject({
      available: true,
      cycleDay: 1,
    });
  });
});

describe('progressStore.claimDailyReward', () => {
  function setup() {
    const storage = new InMemoryStorage();
    const clock = { time: at(0), now: () => clock.time };
    const make = () => createProgressStore(storage, clock);
    return { storage, clock, store: make(), make };
  }

  it('credits the reward to the wallet once per day', () => {
    const { store } = setup();
    const coins = DAILY_REWARDS[0]?.coins ?? 0;
    expect(store.getState().claimDailyReward()).toEqual(DAILY_REWARDS[0]);
    expect(store.getState().coins).toBe(coins);
    expect(store.getState().claimDailyReward()).toBeNull();
    expect(store.getState().coins).toBe(coins);
  });

  it('credits boosters on days that include them', () => {
    const { store, clock } = setup();
    store.getState().claimDailyReward();
    clock.time = at(1);
    store.getState().claimDailyReward();
    const hintsBefore = store.getState().inventory.hint ?? 0;
    clock.time = at(2);
    store.getState().claimDailyReward();
    expect(store.getState().inventory.hint).toBe(hintsBefore + 1);
  });

  it('remembers the claim after a restart', () => {
    const { store, make } = setup();
    store.getState().claimDailyReward();
    const restored = make().getState();
    expect(restored.dailyReward.streak).toBe(1);
    expect(evaluateDaily(restored.dailyReward, at(0)).available).toBe(false);
  });

  it('is part of the exported document and merges from the cloud', () => {
    const { store, make } = setup();
    store.getState().claimDailyReward();
    const doc = store.getState().exportDocument();
    expect(doc.dailyReward.streak).toBe(1);
    const other = make();
    // A fresh device with the same storage already has it; use a new storage.
    const fresh = createProgressStore(new InMemoryStorage(), { now: () => 1 });
    expect(fresh.getState().dailyReward).toEqual(EMPTY_DAILY_RECORD);
    expect(fresh.getState().mergeRemote(doc)).toBe(true);
    expect(fresh.getState().dailyReward).toEqual(doc.dailyReward);
    expect(other.getState().dailyReward.streak).toBe(1);
  });

  it('starts fresh when the saved record is unusable', () => {
    const { storage, make } = setup();
    storage.setString(
      'player.progress',
      JSON.stringify({
        schemaVersion: 3,
        updatedAt: 0,
        highestUnlockedLevel: 1,
        levels: {},
        wallet: { coins: 0 },
        inventory: {},
        tutorialCompleted: false,
        dailyReward: { lastClaimDay: 'x', streak: 2 },
      }),
    );
    expect(make().getState().dailyReward).toEqual(EMPTY_DAILY_RECORD);
  });

  it('upgrades a version 2 save with an empty record', () => {
    const { storage, make } = setup();
    storage.setString(
      'player.progress',
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: 5,
        highestUnlockedLevel: 3,
        levels: {},
        wallet: { coins: 7 },
        inventory: {},
        tutorialCompleted: true,
      }),
    );
    const state = make().getState();
    expect(state.coins).toBe(7);
    expect(state.dailyReward).toEqual(EMPTY_DAILY_RECORD);
  });
});

describe('mergeDailyRecords', () => {
  const rec = (lastClaimDay: number | null, streak: number) => ({
    lastClaimDay,
    streak,
  });

  it('prefers the later claim, then the longer streak', () => {
    expect(mergeDailyRecords(rec(5, 2), rec(6, 1))).toEqual(rec(6, 1));
    expect(mergeDailyRecords(rec(6, 1), rec(5, 2))).toEqual(rec(6, 1));
    expect(mergeDailyRecords(rec(6, 1), rec(6, 3))).toEqual(rec(6, 3));
    expect(mergeDailyRecords(rec(6, 3), rec(6, 1))).toEqual(rec(6, 3));
  });

  it('ignores a never-claimed record', () => {
    expect(mergeDailyRecords(EMPTY_DAILY_RECORD, rec(4, 2))).toEqual(rec(4, 2));
    expect(mergeDailyRecords(rec(4, 2), EMPTY_DAILY_RECORD)).toEqual(rec(4, 2));
  });
});
