jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

import { fixedSource, tinyLevel } from '../testUtils';
import { act, dump, hostByPrefix, launch, press, toHome } from '../harness';
import type { Harness } from '../harness';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';

const host = (h: Harness, id: string) =>
  hostByPrefix(h.r, id).find(n => n.props.testID === id);

async function open(storage = new InMemoryStorage()) {
  const h = await launch(fixedSource(tinyLevel), storage);
  await toHome(h);
  await press(h.r, 'home-settings');
  return { h, storage };
}

describe('settings card, like the reference game', () => {
  it('shows the round switches, the two switches and the five rows', async () => {
    const { h } = await open();
    for (const id of [
      'setting-music',
      'setting-sound',
      'setting-voice',
      'setting-haptics',
      'setting-notifications',
      'setting-color-friendly',
      'setting-language',
      'setting-support',
      'setting-replay-tutorial',
      'setting-about',
    ]) {
      expect(host(h, id)).toBeDefined();
    }
    expect(dump(h.r)).toContain('Version 0.0.1');
  });

  it('turns the music on and off with the music switch', async () => {
    const { h, storage } = await open();
    await press(h.r, 'setting-music');
    expect(
      JSON.parse(storage.getString('player.settings') as string).musicEnabled,
    ).toBe(false);
    expect(h.audio.musicOn).toBe(false);
    await press(h.r, 'setting-music');
    expect(h.audio.musicOn).toBe(true);
  });

  it('keeps the voice switch apart from the sound-effects switch', async () => {
    const { h, storage } = await open();
    await press(h.r, 'setting-voice');
    const saved = JSON.parse(storage.getString('player.settings') as string);
    expect(saved.voiceEnabled).toBe(false);
    expect(saved.soundEnabled).toBe(true);
  });

  it('saves Color-friendly Mode and Notification', async () => {
    const { h, storage } = await open();
    for (const id of ['setting-color-friendly', 'setting-notifications']) {
      const row = h.r.root.findAll(
        n =>
          n.props.testID === id && typeof n.props.onValueChange === 'function',
      )[0];
      expect(row).toBeDefined();
      await act(async () => {
        row?.props.onValueChange(id === 'setting-color-friendly');
      });
    }
    const saved = JSON.parse(storage.getString('player.settings') as string);
    expect(saved.colorFriendly).toBe(true);
    expect(saved.notificationsEnabled).toBe(false);
  });

  it('opens Support with the email address and comes back', async () => {
    const { h } = await open();
    await press(h.r, 'setting-support');
    expect(dump(h.r)).toContain('vintrakart@gmail.com');
    expect(host(h, 'support-email')).toBeDefined();
    await press(h.r, 'setting-support-back');
    expect(host(h, 'setting-music')).toBeDefined();
  });

  it('opens the Privacy Policy and comes back', async () => {
    const { h } = await open();
    await press(h.r, 'setting-privacy');
    expect(dump(h.r)).toContain('does not ask you to sign up');
    expect(host(h, 'setting-music')).toBeUndefined();
    await press(h.r, 'setting-privacy-back');
    expect(host(h, 'setting-music')).toBeDefined();
  });

  it('opens About Us and comes back', async () => {
    const { h } = await open();
    await press(h.r, 'setting-about');
    expect(dump(h.r)).toContain('Match three tiles');
    expect(host(h, 'setting-music')).toBeUndefined();
    await press(h.r, 'setting-about-back');
    expect(host(h, 'setting-music')).toBeDefined();
  });
});

describe('settings toasts', () => {
  const toastText = (h: Harness) => host(h, 'settings-message')?.props.children;

  it('say what a round switch just did, on and off', async () => {
    const { h } = await open();
    await press(h.r, 'setting-music');
    expect(toastText(h)).toBe('Music is off');
    await press(h.r, 'setting-music');
    expect(toastText(h)).toBe('Music is on');
    await press(h.r, 'setting-sound');
    expect(toastText(h)).toBe('Sound is off');
    await press(h.r, 'setting-voice');
    expect(toastText(h)).toBe('Voice is off');
    await press(h.r, 'setting-haptics');
    expect(toastText(h)).toBe('Vibration is off');
  });

  it('also speak for the two switches', async () => {
    const { h } = await open();
    const flip = async (id: string, value: boolean) => {
      const row = h.r.root.findAll(
        n =>
          n.props.testID === id && typeof n.props.onValueChange === 'function',
      )[0];
      await act(async () => {
        row?.props.onValueChange(value);
      });
    };
    await flip('setting-notifications', false);
    expect(toastText(h)).toBe('Notification is off');
    await flip('setting-color-friendly', true);
    expect(toastText(h)).toBe('Color-friendly Mode is on');
  });

  it('fade away after a moment', async () => {
    const { h } = await open();
    await press(h.r, 'setting-music');
    expect(host(h, 'settings-message')).toBeDefined();
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(host(h, 'settings-message')).toBeUndefined();
  });

  it('has no test reminder or save-progress row', async () => {
    const { h } = await open();
    expect(host(h, 'setting-test-reminder')).toBeUndefined();
    expect(host(h, 'cloud-sync')).toBeUndefined();
  });
});
