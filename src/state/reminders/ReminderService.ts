import type { IClock } from '@engine';
import type { IAppLifecycle } from '@services/lifecycle/IAppLifecycle';
import type {
  INotificationService,
  ScheduledNotification,
} from '@services/notifications/INotificationService';
import type { IStorage } from '@services/storage/IStorage';
import { STORAGE_KEYS } from '@services/storage/keys';
import { t } from '@ui/i18n/strings';
import type { ProgressStore } from '../progressStore';
import type { SettingsStore } from '../settingsStore';
import { planDailyReminder, planReminders } from './reminderPlan';

interface Deps {
  notifications: INotificationService;
  lifecycle: IAppLifecycle;
  settings: SettingsStore;
  progress: ProgressStore;
  storage: IStorage;
  clock: IClock;
}

/**
 * Daily-reward, streak and come-back reminders. While the app is open nothing is pending. When the
 * player leaves, the next few reminders are scheduled with the OS; when they
 * return, those are cancelled. The Settings switch controls all of it.
 *
 * The system permission prompt is shown once, the first time the app opens (or
 * when the player turns the switch on). Reminders themselves are only scheduled
 * after the tutorial.
 */
export class ReminderService {
  /** A developer test reminder, kept through foreground/background changes. */
  private testReminder: ScheduledNotification | null = null;

  constructor(private readonly deps: Deps) {}

  /** Returns a function that stops the service. */
  start(): () => void {
    const { lifecycle, settings } = this.deps;
    const stopLifecycle = lifecycle.subscribe(state => {
      const work = state === 'background' ? this.schedule() : this.onReturn();
      work.catch(() => undefined);
    });
    let wasEnabled = settings.getState().notificationsEnabled;
    const stopSettings = settings.subscribe(state => {
      if (state.notificationsEnabled === wasEnabled) {
        return;
      }
      wasEnabled = state.notificationsEnabled;
      this.onSwitchChanged(wasEnabled).catch(() => undefined);
    });
    this.onReturn().catch(() => undefined);
    return () => {
      stopLifecycle();
      stopSettings();
    };
  }

  private get enabled(): boolean {
    return this.deps.settings.getState().notificationsEnabled;
  }

  /** The app is in front: nothing should fire, and this is when we ask once. */
  private async onReturn(): Promise<void> {
    const { notifications } = this.deps;
    if (!notifications.isAvailable) {
      return;
    }
    const test = this.pendingTest();
    await (test ? notifications.replaceAll([test]) : notifications.cancelAll());
    if (this.enabled) {
      await this.askOnce();
    }
  }

  private async schedule(): Promise<void> {
    const { notifications, progress, clock } = this.deps;
    if (!notifications.isAvailable) {
      return;
    }
    const now = clock.now();
    const allowed =
      this.enabled &&
      progress.getState().tutorialCompleted &&
      (await notifications.getPermission()) === 'granted';
    const test = this.pendingTest();
    if (!allowed) {
      // A developer test reminder still goes out; the real ones do not.
      await (test
        ? notifications.replaceAll([test])
        : notifications.cancelAll());
      return;
    }
    await notifications.replaceAll(
      [
        planDailyReminder(progress.getState().dailyReward, now),
        ...planReminders(now),
      ]
        .map(reminder => ({
          id: reminder.id,
          fireAt: reminder.fireAt,
          title: t(reminder.titleKey, reminder.vars),
          body: t(reminder.bodyKey, reminder.vars),
        }))
        .concat(test ? [test] : []),
    );
  }

  private pendingTest(): ScheduledNotification | null {
    const test = this.testReminder;
    return test && test.fireAt > this.deps.clock.now() ? test : null;
  }

  /**
   * For checking on a real device: shows one reminder after `delayMs`, without
   * waiting for the real schedule. Resolves to false if it cannot be shown
   * (unavailable, or no permission).
   */
  async sendTestReminder(delayMs = 10_000): Promise<boolean> {
    const { notifications, clock } = this.deps;
    if (
      !notifications.isAvailable ||
      (await notifications.getPermission()) !== 'granted'
    ) {
      return false;
    }
    this.testReminder = {
      id: 'test',
      fireAt: clock.now() + delayMs,
      title: t('notify.test.title'),
      body: t('notify.test.body'),
    };
    await notifications.replaceAll([this.testReminder]);
    return true;
  }

  private async onSwitchChanged(on: boolean): Promise<void> {
    const { notifications, settings } = this.deps;
    if (!notifications.isAvailable) {
      return;
    }
    if (!on) {
      await notifications.cancelAll();
      return;
    }
    const permission = await notifications.requestPermission();
    if (permission !== 'granted') {
      // The player said no at the system level; show the switch as off.
      settings.getState().setNotificationsEnabled(false);
    }
  }

  /**
   * Shows the system prompt the first time only. Android never reports "not
   * asked yet" (only granted or denied), so whether we have asked is kept here.
   */
  private async askOnce(): Promise<void> {
    const { notifications, settings, storage } = this.deps;
    if (storage.getString(STORAGE_KEYS.notificationPrompted) === '1') {
      return;
    }
    if ((await notifications.getPermission()) === 'granted') {
      return;
    }
    storage.setString(STORAGE_KEYS.notificationPrompted, '1');
    if ((await notifications.requestPermission()) !== 'granted') {
      settings.getState().setNotificationsEnabled(false);
    }
  }
}
