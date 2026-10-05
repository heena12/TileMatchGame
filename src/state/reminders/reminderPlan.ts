import { STREAK_WARNING_MIN } from '@config/dailyReward';
import type { StringKey, StringVars } from '@ui/i18n/strings';
import { dayNumber, evaluateDaily } from '../daily/dailyReward';
import type { DailyRewardRecord } from '../daily/dailyReward';

/** One come-back reminder: how long after the player leaves, and what it says. */
export interface ReminderTemplate {
  readonly id: string;
  readonly afterDays: number;
  readonly titleKey: StringKey;
  readonly bodyKey: StringKey;
}

/** Local hour of day (0-23) reminders are shown at, so none wake the player. */
export const REMINDER_HOUR = 18;

/**
 * Plain come-back reminders for a player who stays away. Day 1 is covered by
 * the daily-reward / streak reminder instead. Data only.
 */
export const REMINDER_TEMPLATES: readonly ReminderTemplate[] = [
  {
    id: 'comeback-3d',
    afterDays: 3,
    titleKey: 'notify.day3.title',
    bodyKey: 'notify.day3.body',
  },
  {
    id: 'comeback-7d',
    afterDays: 7,
    titleKey: 'notify.day7.title',
    bodyKey: 'notify.day7.body',
  },
];

export interface PlannedReminder {
  readonly id: string;
  readonly fireAt: number;
  readonly titleKey: StringKey;
  readonly bodyKey: StringKey;
  /** Values for {placeholders} in the texts. */
  readonly vars?: StringVars;
}

/** `hour` o'clock local time, `daysFromNow` calendar days after `from`. */
function at(from: number, daysFromNow: number, hour: number): number {
  const when = new Date(from);
  when.setDate(when.getDate() + daysFromNow);
  when.setHours(hour, 0, 0, 0);
  return when.getTime();
}

/**
 * Pure: when each come-back reminder should fire, given when the player left.
 * `afterDays` calendar days later at `hour` local time, so the reminder lands
 * at a sensible time of day whatever time the player stopped.
 */
export function planReminders(
  leftAt: number,
  templates: readonly ReminderTemplate[] = REMINDER_TEMPLATES,
  hour: number = REMINDER_HOUR,
): PlannedReminder[] {
  return templates.map(template => ({
    id: template.id,
    fireAt: at(leftAt, template.afterDays, hour),
    titleKey: template.titleKey,
    bodyKey: template.bodyKey,
  }));
}

/**
 * Pure: the one reminder about the daily reward.
 *
 * - Reward still unclaimed: remind at the next reminder hour (today if it has
 *   not passed, otherwise tomorrow).
 * - Reward claimed today: remind tomorrow, when the next one is waiting.
 *
 * If the player has a streak worth keeping that would still be alive when the
 * reminder fires, the text warns that it is about to be lost.
 */
export function planDailyReminder(
  record: DailyRewardRecord,
  now: number,
  hour: number = REMINDER_HOUR,
): PlannedReminder {
  const status = evaluateDaily(record, now);
  const today = dayNumber(now);
  const todaysSlot = at(now, 0, hour);
  const fireAt =
    status.available && now < todaysSlot ? todaysSlot : at(now, 1, hour);
  // The streak survives until the end of the day after the last claim.
  const alive =
    record.lastClaimDay !== null &&
    dayNumber(fireAt) - record.lastClaimDay <= 1 &&
    today >= record.lastClaimDay;
  if (alive && record.streak >= STREAK_WARNING_MIN) {
    return {
      id: 'daily-streak',
      fireAt,
      titleKey: 'notify.streak.title',
      bodyKey: 'notify.streak.body',
      vars: { days: record.streak },
    };
  }
  return {
    id: 'daily-reward',
    fireAt,
    titleKey: 'notify.reward.title',
    bodyKey: 'notify.reward.body',
  };
}
