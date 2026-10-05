jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

import { fixedSource, tinyLevel } from '../testUtils';
import {
  act,
  advance,
  byId,
  dump,
  hostByPrefix,
  launch,
  press,
  toHome,
} from '../harness';
import type { Harness } from '../harness';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { BADGE_SHAPES, badgeShape } from '@ui/components/TileBadge';

const host = (h: Harness, id: string) =>
  hostByPrefix(h.r, id).find(n => n.props.testID === id);

async function open(storage = new InMemoryStorage()) {
  const h = await launch(fixedSource(tinyLevel), storage);
  await toHome(h);
  await press(h.r, 'home-settings');
  return { h, storage };
}

const saved = (storage: InMemoryStorage) =>
  JSON.parse(storage.getString('player.settings') as string);

const flip = async (h: Harness, id: string, value: boolean) => {
  const row = h.r.root.findAll(
    n => n.props.testID === id && typeof n.props.onValueChange === 'function',
  )[0];
  await act(async () => {
    row?.props.onValueChange(value);
  });
};

describe('language in Settings', () => {
  it('shows the current language on the row and opens a list of all five', async () => {
    const { h } = await open();
    expect(dump(h.r)).toContain('English');
    await press(h.r, 'setting-language');
    for (const code of ['en', 'hi', 'gu', 'es', 'fr']) {
      expect(byId(h.r, `language-${code}`)).toBeDefined();
    }
    expect(host(h, 'language-selected')).toBeDefined();
  });

  it('changes the whole app at once and remembers it', async () => {
    const { h, storage } = await open();
    await press(h.r, 'setting-language');
    await press(h.r, 'language-hi');
    expect(saved(storage).language).toBe('hi');
    // The card itself is already in Hindi...
    expect(dump(h.r)).toContain('भाषा');
    await press(h.r, 'setting-language-back');
    expect(dump(h.r)).toContain('सेटिंग्स');
    await press(h.r, 'setting-close');
    // ...and so is the screen behind it.
    expect(dump(h.r)).toContain('लेवल 1');
  });

  it('is still in that language after the app is opened again', async () => {
    const { h, storage } = await open();
    await press(h.r, 'setting-language');
    await press(h.r, 'language-fr');
    await act(async () => {
      h.r.unmount();
    });
    const again = await launch(fixedSource(tinyLevel), storage);
    await toHome(again);
    expect(dump(again.r)).toContain('Niveau 1');
  });

  it('can go back to English', async () => {
    const { h } = await open();
    await press(h.r, 'setting-language');
    await press(h.r, 'language-es');
    expect(dump(h.r)).toContain('Idioma');
    await press(h.r, 'language-en');
    expect(dump(h.r)).toContain('Language');
  });
});

describe('Color-friendly Mode', () => {
  it('turns on at once, and says so', async () => {
    const { h, storage } = await open();
    await flip(h, 'setting-color-friendly', true);
    expect(saved(storage).colorFriendly).toBe(true);
    expect(host(h, 'settings-message')?.props.children).toBe(
      'Color-friendly Mode is on',
    );
    expect(host(h, 'color-confirm')).toBeUndefined();
  });

  it('asks before switching off, and No keeps it on', async () => {
    const { h, storage } = await open();
    await flip(h, 'setting-color-friendly', true);
    await flip(h, 'setting-color-friendly', false);
    expect(host(h, 'color-confirm')).toBeDefined();
    expect(dump(h.r)).toContain(
      'When disabled, these level types will return:',
    );
    expect(dump(h.r)).toContain('Color variation levels');
    expect(saved(storage).colorFriendly).toBe(true);
    await press(h.r, 'color-confirm-no');
    expect(host(h, 'color-confirm')).toBeUndefined();
    expect(saved(storage).colorFriendly).toBe(true);
  });

  it('Yes switches it off', async () => {
    const { h, storage } = await open();
    await flip(h, 'setting-color-friendly', true);
    await flip(h, 'setting-color-friendly', false);
    await press(h.r, 'color-confirm-yes');
    expect(host(h, 'color-confirm')).toBeUndefined();
    expect(saved(storage).colorFriendly).toBe(false);
    expect(host(h, 'settings-message')?.props.children).toBe(
      'Color-friendly Mode is off',
    );
  });

  it('puts a shape badge on every tile while it is on, and none while it is off', async () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.settings',
      JSON.stringify({ schemaVersion: 1, colorFriendly: true }),
    );
    const h = await launch(fixedSource(tinyLevel), storage);
    await toHome(h);
    await press(h.r, 'home-continue');
    await advance(500);
    expect(hostByPrefix(h.r, 'tile-badge').length).toBeGreaterThanOrEqual(6);

    const plain = await launch(fixedSource(tinyLevel));
    await toHome(plain);
    await press(plain.r, 'home-continue');
    await advance(500);
    expect(hostByPrefix(plain.r, 'tile-badge')).toHaveLength(0);
  });
});

describe('tile badges', () => {
  it('give a picture the same mark every time, from a fixed set', () => {
    expect(BADGE_SHAPES).toEqual(['○', '△', '☆', '□', '◇', '♡']);
    expect(badgeShape(1)).toBe(badgeShape(1));
    expect(badgeShape(1)).not.toBe(badgeShape(2));
    expect(badgeShape(7)).toBe(badgeShape(1));
    expect(badgeShape(-3)).toBe(badgeShape(3));
  });
});
