export type NotificationPermission = 'granted' | 'denied' | 'undetermined';

/** One reminder to be shown by the operating system at `fireAt`. */
export interface ScheduledNotification {
  /** Stable id, so rescheduling replaces rather than duplicates. */
  readonly id: string;
  /** Epoch milliseconds. */
  readonly fireAt: number;
  readonly title: string;
  readonly body: string;
}

/**
 * Local (on-device) notifications. A remote push adapter can implement the
 * same port later without the game rules changing.
 * Every method must resolve, never reject.
 */
export interface INotificationService {
  /** False where the platform cannot show notifications (web, tests). */
  readonly isAvailable: boolean;
  /** Reads the current permission without prompting. */
  getPermission(): Promise<NotificationPermission>;
  /** Shows the system prompt if it has not been answered yet. */
  requestPermission(): Promise<NotificationPermission>;
  /** Cancels everything pending, then schedules exactly `items`. */
  replaceAll(items: readonly ScheduledNotification[]): Promise<void>;
  cancelAll(): Promise<void>;
}
