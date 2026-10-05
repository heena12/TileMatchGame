import type {
  INotificationService,
  NotificationPermission,
  ScheduledNotification,
} from './INotificationService';

/** Used on web and wherever the native module is missing. */
export class NoopNotifications implements INotificationService {
  readonly isAvailable = false;

  async getPermission(): Promise<NotificationPermission> {
    return 'denied';
  }

  async requestPermission(): Promise<NotificationPermission> {
    return 'denied';
  }

  async replaceAll(_items: readonly ScheduledNotification[]): Promise<void> {}

  async cancelAll(): Promise<void> {}
}
