import type {
  INotificationService,
  NotificationPermission,
  ScheduledNotification,
} from './INotificationService';

/**
 * Android fixes a channel's sound when it is first created, so a new sound
 * needs a new id. The sound is res/raw/reminder_chime.wav (see
 * tools/generate_reminder_chime.py).
 */
export const REMINDER_CHANNEL_ID = 'reminders_chime';
export const REMINDER_SOUND = 'reminder_chime';
export const NOTIFICATION_ICON = 'ic_notification';
export const NOTIFICATION_COLOR = '#F59E0B';

/** The slice of @notifee/react-native used here, so tests can fake it. */
export interface NotifeeModule {
  default: {
    requestPermission(): Promise<{ authorizationStatus: number }>;
    getNotificationSettings(): Promise<{ authorizationStatus: number }>;
    createChannel(channel: {
      id: string;
      name: string;
      importance: number;
      sound?: string;
    }): Promise<string>;
    createTriggerNotification(
      notification: {
        id: string;
        title: string;
        body: string;
        android: {
          channelId: string;
          smallIcon: string;
          color: string;
          pressAction: { id: string };
        };
      },
      trigger: {
        type: number;
        timestamp: number;
        alarmManager: { type: number };
      },
    ): Promise<string>;
    cancelAllNotifications(): Promise<void>;
  };
  AuthorizationStatus: {
    NOT_DETERMINED: number;
    DENIED: number;
    AUTHORIZED: number;
    PROVISIONAL: number;
  };
  TriggerType: { TIMESTAMP: number };
  AlarmType: { SET_AND_ALLOW_WHILE_IDLE: number };
  AndroidImportance: { DEFAULT: number };
}

export class NotifeeNotifications implements INotificationService {
  readonly isAvailable = true;

  constructor(
    private readonly sdk: NotifeeModule,
    private readonly channelName: string,
  ) {}

  async getPermission(): Promise<NotificationPermission> {
    try {
      const { authorizationStatus } =
        await this.sdk.default.getNotificationSettings();
      return this.toPermission(authorizationStatus);
    } catch {
      return 'denied';
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    try {
      const { authorizationStatus } =
        await this.sdk.default.requestPermission();
      return this.toPermission(authorizationStatus);
    } catch {
      return 'denied';
    }
  }

  async replaceAll(items: readonly ScheduledNotification[]): Promise<void> {
    try {
      const {
        default: notifee,
        TriggerType,
        AlarmType,
        AndroidImportance,
      } = this.sdk;
      await notifee.cancelAllNotifications();
      if (items.length === 0) {
        return;
      }
      const channelId = await notifee.createChannel({
        id: REMINDER_CHANNEL_ID,
        name: this.channelName,
        importance: AndroidImportance.DEFAULT,
        sound: REMINDER_SOUND,
      });
      for (const item of items) {
        await notifee.createTriggerNotification(
          {
            id: item.id,
            title: item.title,
            body: item.body,
            android: {
              channelId,
              smallIcon: NOTIFICATION_ICON,
              color: NOTIFICATION_COLOR,
              pressAction: { id: 'default' },
            },
          },
          {
            type: TriggerType.TIMESTAMP,
            timestamp: item.fireAt,
            // AlarmManager fires on time even when the phone is idle; the
            // default (WorkManager) can be delayed or skipped for hours.
            alarmManager: { type: AlarmType.SET_AND_ALLOW_WHILE_IDLE },
          },
        );
      }
    } catch (error) {
      // Reminders are a nicety; never let them break the app, but say why.
      console.warn('[notifications] scheduling failed', error);
    }
  }

  async cancelAll(): Promise<void> {
    try {
      await this.sdk.default.cancelAllNotifications();
    } catch (error) {
      console.warn('[notifications] cancel failed', error);
    }
  }

  private toPermission(status: number): NotificationPermission {
    const { AuthorizationStatus: s } = this.sdk;
    if (status === s.AUTHORIZED || status === s.PROVISIONAL) {
      return 'granted';
    }
    return status === s.NOT_DETERMINED ? 'undetermined' : 'denied';
  }
}
