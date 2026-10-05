import { NotifeeNotifications } from '@services/notifications/NotifeeNotifications';
import type { NotifeeModule } from '@services/notifications/NotifeeNotifications';
import { NoopNotifications } from '@services/notifications/NoopNotifications';

function fakeSdk(status = 1, fail = false) {
  const calls: string[] = [];
  const channels: { id: string; sound?: string }[] = [];
  const guard = async <T>(name: string, value: T): Promise<T> => {
    calls.push(name);
    if (fail) {
      throw new Error('native failure');
    }
    return value;
  };
  const sdk: NotifeeModule = {
    default: {
      requestPermission: () =>
        guard('request', { authorizationStatus: status }),
      getNotificationSettings: () =>
        guard('settings', { authorizationStatus: status }),
      createChannel: channel => {
        channels.push(channel);
        return guard('channel', channel.id);
      },
      createTriggerNotification: () => guard('trigger', 'id'),
      cancelAllNotifications: () => guard('cancel', undefined),
    },
    AuthorizationStatus: {
      NOT_DETERMINED: -1,
      DENIED: 0,
      AUTHORIZED: 1,
      PROVISIONAL: 2,
    },
    TriggerType: { TIMESTAMP: 0 },
    AlarmType: { SET_AND_ALLOW_WHILE_IDLE: 1 },
    AndroidImportance: { DEFAULT: 3 },
  };
  return { sdk, calls, channels };
}

const item = (id: string) => ({ id, fireAt: 1000, title: 't', body: 'b' });

describe('NotifeeNotifications', () => {
  it.each([
    [1, 'granted'],
    [2, 'granted'],
    [0, 'denied'],
    [-1, 'undetermined'],
  ])('maps status %i to %s', async (status, expected) => {
    const { sdk } = fakeSdk(status);
    const service = new NotifeeNotifications(sdk, 'Reminders');
    expect(await service.getPermission()).toBe(expected);
    expect(await service.requestPermission()).toBe(expected);
  });

  it('replaces: cancels, then creates the channel and one trigger per item', async () => {
    const { sdk, calls } = fakeSdk();
    await new NotifeeNotifications(sdk, 'Reminders').replaceAll([
      item('a'),
      item('b'),
    ]);
    expect(calls).toEqual(['cancel', 'channel', 'trigger', 'trigger']);
  });

  it('creates the channel with the chime sound', async () => {
    const { sdk, channels } = fakeSdk();
    await new NotifeeNotifications(sdk, 'Reminders').replaceAll([item('a')]);
    expect(channels).toHaveLength(1);
    expect(channels[0]?.sound).toBe('reminder_chime');
  });

  it('only cancels when given nothing to schedule', async () => {
    const { sdk, calls } = fakeSdk();
    await new NotifeeNotifications(sdk, 'Reminders').replaceAll([]);
    expect(calls).toEqual(['cancel']);
  });

  it('never rejects when the native side fails', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const { sdk } = fakeSdk(1, true);
    const service = new NotifeeNotifications(sdk, 'Reminders');
    await expect(service.replaceAll([item('a')])).resolves.toBeUndefined();
    await expect(service.cancelAll()).resolves.toBeUndefined();
    expect(await service.getPermission()).toBe('denied');
    expect(await service.requestPermission()).toBe('denied');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('NoopNotifications', () => {
  it('is unavailable and denies permission', async () => {
    const noop = new NoopNotifications();
    expect(noop.isAvailable).toBe(false);
    expect(await noop.requestPermission()).toBe('denied');
    expect(await noop.getPermission()).toBe('denied');
    await noop.replaceAll([item('a')]);
    await noop.cancelAll();
  });
});
