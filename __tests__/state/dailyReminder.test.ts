import { EMPTY_DAILY_RECORD, dayNumber } from '@state/daily/dailyReward';
import {
  REMINDER_HOUR,
  planDailyReminder,
} from '@state/reminders/reminderPlan';

const day = (offset: number, hour = 9) =>
  new Date(2026, 0, 10 + offset, hour).getTime();
const record = (claimOffset: number, streak: number) => ({
  lastClaimDay: dayNumber(day(claimOffset)),
  streak,
});

describe('planDailyReminder', () => {
  it('reminds at the reminder hour today when the reward is unclaimed', () => {
    const plan = planDailyReminder(EMPTY_DAILY_RECORD, day(0, 9));
    expect(plan.id).toBe('daily-reward');
    expect(plan.fireAt).toBe(day(0, REMINDER_HOUR));
  });

  it('reminds tomorrow if the reminder hour has already passed', () => {
    const plan = planDailyReminder(EMPTY_DAILY_RECORD, day(0, 20));
    expect(plan.fireAt).toBe(day(1, REMINDER_HOUR));
  });

  it('reminds tomorrow after a claim today', () => {
    const plan = planDailyReminder(record(0, 1), day(0, 10));
    expect(plan.id).toBe('daily-reward');
    expect(plan.fireAt).toBe(day(1, REMINDER_HOUR));
  });

  it('warns about a streak of 2 or more claimed today', () => {
    const plan = planDailyReminder(record(0, 3), day(0, 10));
    expect(plan.id).toBe('daily-streak');
    expect(plan.vars).toEqual({ days: 3 });
    expect(plan.fireAt).toBe(day(1, REMINDER_HOUR));
  });

  it('warns today when yesterday extended a streak and today is unclaimed', () => {
    const plan = planDailyReminder(record(-1, 4), day(0, 9));
    expect(plan.id).toBe('daily-streak');
    expect(plan.fireAt).toBe(day(0, REMINDER_HOUR));
  });

  it('does not warn once the streak would already be lost', () => {
    const plan = planDailyReminder(record(-1, 4), day(0, 20));
    expect(plan.id).toBe('daily-reward');
  });

  it('does not warn for a streak of 1', () => {
    const plan = planDailyReminder(record(0, 1), day(0, 10));
    expect(plan.id).toBe('daily-reward');
  });
});
