import type {
  INotificationService,
  NotificationPermission,
  ScheduledNotification,
} from './INotificationService';

/** Keeps scheduled notifications in memory. Used by tests. */
export class RecordingNotifications implements INotificationService {
  readonly isAvailable = true;
  scheduled: readonly ScheduledNotification[] = [];
  permissionRequests = 0;
  private prompted = false;

  constructor(
    public permission: NotificationPermission = 'undetermined',
    /** What the system prompt will answer when the player is asked. */
    private readonly answer: NotificationPermission = 'granted',
  ) {}

  async getPermission(): Promise<NotificationPermission> {
    return this.permission;
  }

  async requestPermission(): Promise<NotificationPermission> {
    this.permissionRequests += 1;
    // Like the real system, the prompt only appears until it has been answered.
    if (this.permission !== 'granted' && !this.prompted) {
      this.prompted = true;
      this.permission = this.answer;
    }
    return this.permission;
  }

  async replaceAll(items: readonly ScheduledNotification[]): Promise<void> {
    this.scheduled = items;
  }

  async cancelAll(): Promise<void> {
    this.scheduled = [];
  }
}
