import type { INotificationService } from './INotificationService';
import { NoopNotifications } from './NoopNotifications';

/** Web build: no local notifications. Picked automatically over createNotifications.ts. */
export function createNotifications(
  _channelName: string,
): INotificationService {
  return new NoopNotifications();
}
