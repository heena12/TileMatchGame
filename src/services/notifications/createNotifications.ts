import type { INotificationService } from './INotificationService';
import { NoopNotifications } from './NoopNotifications';
import { NotifeeNotifications } from './NotifeeNotifications';
import type { NotifeeModule } from './NotifeeNotifications';

/**
 * Android / iOS: @notifee/react-native. The web build swaps this file for
 * createNotifications.web.ts. A missing native module (tests, unlinked build)
 * falls back to doing nothing.
 */
export function createNotifications(channelName: string): INotificationService {
  try {
    const sdk = require('@notifee/react-native') as NotifeeModule;
    return new NotifeeNotifications(sdk, channelName);
  } catch {
    return new NoopNotifications();
  }
}
