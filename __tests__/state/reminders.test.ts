import { ManualLifecycle } from '@services/lifecycle/ManualLifecycle';
import { RecordingNotifications } from '@services/notifications/RecordingNotifications';
import type { NotificationPermission } from '@services/notifications/INotificationService';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { createProgressStore } from '@state/progressStore';
import { ReminderService } from '@state/reminders/ReminderService';
import {
  REMINDER_HOUR,
  REMINDER_TEMPLATES,
  planReminders,
} from '@state/reminders/reminderPlan';
import { createSettingsStore } from '@state/settingsStore';

const NOW = new Date(2026, 0, 10, 9, 30).getTime();

/** Lets queued promise callbacks run. */
const flush = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function setup(
  permission: NotificationPermission = 'granted',
  answer: NotificationPermission = 'granted',
  tutorialDone = true,
) {
  const storage = new InMemoryStorage();
  const notifications = new RecordingNotifications(permission, answer);
  const lifecycle = new ManualLifecycle();
  const settings = createSettingsStore(storage);
  const progress = createProgressStore(storage, { now: () => NOW });
  if (tutorialDone) {
    progress.getState().completeTutorial();
  }
  const clock = { now: () => NOW };
  const service = new ReminderService({
    notifications,
    lifecycle,
    settings,
    progress,
    storage,
    clock,
  });
  const stop = service.start();
  return { notifications, lifecycle, settings, progress, service, stop };
}

describe('planReminders', () => {
  it('fires each reminder on a later day at the reminder hour', () => {
    const plan = planReminders(NOW);
    expect(plan.map(p => p.id)).toEqual(REMINDER_TEMPLATES.map(t => t.id));
    plan.forEach((reminder, i) => {
      const when = new Date(reminder.fireAt);
      expect(when.getHours()).toBe(REMINDER_HOUR);
      expect(when.getMinutes()).toBe(0);
      const days = Math.round((reminder.fireAt - NOW) / (24 * 60 * 60 * 1000));
      expect(days).toBe(REMINDER_TEMPLATES[i]?.afterDays);
      expect(reminder.fireAt).toBeGreaterThan(NOW);
    });
  });

  it('is ordered by time', () => {
    const times = planReminders(NOW).map(p => p.fireAt);
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });
});

describe('ReminderService', () => {
  it('schedules reminders when the app goes to the background', async () => {
    const { notifications, lifecycle } = setup();
    await flush();
    expect(notifications.scheduled).toHaveLength(0);
    lifecycle.emit('background');
    await flush();
    expect(notifications.scheduled).toHaveLength(REMINDER_TEMPLATES.length + 1);
    expect(notifications.scheduled[0]?.title).toBe(
      'Your daily reward is ready!',
    );
  });

  it('cancels them when the player returns', async () => {
    const { notifications, lifecycle } = setup();
    lifecycle.emit('background');
    await flush();
    lifecycle.emit('active');
    await flush();
    expect(notifications.scheduled).toHaveLength(0);
  });

  it('schedules nothing when the switch is off', async () => {
    const { notifications, lifecycle, settings } = setup();
    settings.getState().setNotificationsEnabled(false);
    lifecycle.emit('background');
    await flush();
    expect(notifications.scheduled).toHaveLength(0);
  });

  it('schedules nothing without system permission', async () => {
    const { notifications, lifecycle } = setup('denied', 'denied');
    lifecycle.emit('background');
    await flush();
    expect(notifications.scheduled).toHaveLength(0);
  });

  it('asks on first launch but schedules nothing during the tutorial', async () => {
    const { notifications, lifecycle } = setup(
      'undetermined',
      'granted',
      false,
    );
    await flush();
    expect(notifications.permissionRequests).toBe(1);
    lifecycle.emit('background');
    await flush();
    expect(notifications.scheduled).toHaveLength(0);
  });

  it('asks for permission on first launch', async () => {
    const { notifications } = setup('undetermined');
    await flush();
    expect(notifications.permissionRequests).toBe(1);
    expect(notifications.permission).toBe('granted');
  });

  it('does not ask again once answered', async () => {
    const { notifications, lifecycle } = setup('undetermined');
    await flush();
    lifecycle.emit('active');
    await flush();
    expect(notifications.permissionRequests).toBe(1);
  });

  it('turns the switch off if the player refuses the system prompt', async () => {
    const { settings } = setup('undetermined', 'denied');
    await flush();
    expect(settings.getState().notificationsEnabled).toBe(false);
  });

  it('asks when the switch is turned on, and keeps it on if granted', async () => {
    const { notifications, settings } = setup('undetermined', 'granted', false);
    settings.getState().setNotificationsEnabled(false);
    await flush();
    settings.getState().setNotificationsEnabled(true);
    await flush();
    expect(notifications.permissionRequests).toBe(1);
    expect(settings.getState().notificationsEnabled).toBe(true);
  });

  it('switches off again when the system refuses', async () => {
    const { settings } = setup('undetermined', 'denied', false);
    settings.getState().setNotificationsEnabled(false);
    settings.getState().setNotificationsEnabled(true);
    await flush();
    expect(settings.getState().notificationsEnabled).toBe(false);
  });

  it('cancels pending reminders when the switch is turned off', async () => {
    const { notifications, settings } = setup();
    await notifications.replaceAll([
      { id: 'x', fireAt: NOW + 1, title: 't', body: 'b' },
    ]);
    settings.getState().setNotificationsEnabled(false);
    await flush();
    expect(notifications.scheduled).toHaveLength(0);
  });

  it('stops reacting after stop()', async () => {
    const { notifications, lifecycle, stop } = setup();
    stop();
    lifecycle.emit('background');
    await flush();
    expect(notifications.scheduled).toHaveLength(0);
  });

  it('asks on Android, where "not asked yet" is reported as denied', async () => {
    const { notifications, settings } = setup('denied', 'granted');
    await flush();
    expect(notifications.permissionRequests).toBe(1);
    expect(settings.getState().notificationsEnabled).toBe(true);
  });

  it('does not ask again after a refusal, on later returns', async () => {
    const { notifications, lifecycle } = setup('denied');
    await flush();
    lifecycle.emit('active');
    await flush();
    expect(notifications.permissionRequests).toBe(1);
  });

  it('does not ask when permission is already granted', async () => {
    const { notifications } = setup('granted');
    await flush();
    expect(notifications.permissionRequests).toBe(0);
  });

  it('sends a test reminder that survives leaving and returning', async () => {
    const { notifications, lifecycle, service } = setup();
    await flush();
    expect(await service.sendTestReminder(10_000)).toBe(true);
    expect(notifications.scheduled.map(n => n.id)).toEqual(['test']);
    expect(notifications.scheduled[0]?.fireAt).toBe(NOW + 10_000);
    lifecycle.emit('background');
    await flush();
    expect(notifications.scheduled.map(n => n.id)).toContain('test');
    lifecycle.emit('active');
    await flush();
    expect(notifications.scheduled.map(n => n.id)).toEqual(['test']);
  });

  it('refuses a test reminder without permission', async () => {
    const { service, notifications } = setup('denied', 'denied');
    await flush();
    expect(await service.sendTestReminder()).toBe(false);
    expect(notifications.scheduled).toHaveLength(0);
  });

  it('keeps a test reminder when leaving before the tutorial is done', async () => {
    const { notifications, lifecycle, service } = setup(
      'granted',
      'granted',
      false,
    );
    await flush();
    expect(await service.sendTestReminder(10_000)).toBe(true);
    lifecycle.emit('background');
    await flush();
    expect(notifications.scheduled.map(n => n.id)).toEqual(['test']);
  });
});
