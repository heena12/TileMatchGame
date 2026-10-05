jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

import { fixedSource, tinyLevel } from '../testUtils';
import { byId, dump, hostByPrefix, launch, press, toHome } from '../harness';
import type { Harness } from '../harness';

const host = (h: Harness, id: string) =>
  hostByPrefix(h.r, id).find(n => n.props.testID === id);
import { InMemoryStorage } from '@services/storage/InMemoryStorage';

const withCoins = (coins: number) => {
  const storage = new InMemoryStorage();
  storage.setString(
    'player.progress',
    JSON.stringify({
      schemaVersion: 1,
      updatedAt: 1,
      highestUnlockedLevel: 1,
      coins,
      levels: {},
    }),
  );
  return storage;
};

describe('shop', () => {
  it('opens from the cart button next to the coins', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'open-shop');
    expect(host(h, 'shop')).toBeDefined();
    expect(dump(h.r)).toContain('Shop');
  });

  it('buys a booster with coins and shows the new stock', async () => {
    const h = await launch(fixedSource(tinyLevel), withCoins(100));
    await toHome(h);
    await press(h.r, 'open-shop');
    await press(h.r, 'shop-buy-undo');
    expect(dump(h.r)).toContain('Undo added!');
    expect(host(h, 'shop-coins')?.props.children).toBe(70);
    expect(host(h, 'shop-stock-undo')?.props.children).toBe(1);
  });

  it('says so when there are not enough coins', async () => {
    const h = await launch(fixedSource(tinyLevel), withCoins(0));
    await toHome(h);
    await press(h.r, 'open-shop');
    await press(h.r, 'shop-buy-shuffle');
    expect(dump(h.r)).toContain('Not enough coins.');
  });

  it('is honest that real-money offers are not available yet', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'open-shop');
    await press(h.r, 'shop-bundle-super');
    expect(dump(h.r)).toContain('Purchases are not available yet.');
  });
});

describe('settings popup', () => {
  it('closes with the X button', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-settings');
    expect(host(h, 'setting-sound')).toBeDefined();
    await press(h.r, 'setting-close');
    expect(host(h, 'setting-sound')).toBeUndefined();
    expect(byId(h.r, 'home-continue')).toBeDefined();
  });
});
