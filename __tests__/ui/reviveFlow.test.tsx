jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

import { REVIVE_COST, REVIVE_COUNTDOWN_S } from '@config/revive';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { fixedSource, losingLevel } from '../testUtils';
import {
  advance,
  byId,
  dump,
  hostByPrefix,
  launch,
  press,
  toHome,
} from '../harness';
import type { Harness } from '../harness';

const withCoins = (coins: number) => {
  const storage = new InMemoryStorage();
  storage.setString(
    'player.progress',
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: 1,
      highestUnlockedLevel: 1,
      levels: {},
      wallet: { coins },
      inventory: {},
      tutorialCompleted: true,
    }),
  );
  return storage;
};

const host = (h: Harness, id: string) =>
  hostByPrefix(h.r, id).find(n => n.props.testID === id);

async function loseALevel(coins: number) {
  const h = await launch(fixedSource(losingLevel), withCoins(coins));
  await toHome(h);
  await press(h.r, 'home-continue');
  for (const id of [1, 4, 7, 10, 13, 16, 19]) {
    await press(h.r, `tile-${id}`);
  }
  return h;
}

const coinsOf = (h: Harness) =>
  h.container.model.stores.progress.getState().coins;

describe('the lose screen', () => {
  it('stays on the board with a countdown, the odds, the bird and the buttons', async () => {
    const h = await loseALevel(500);
    expect(host(h, 'revive-overlay')).toBeDefined();
    expect(host(h, 'crying-bird')).toBeDefined();
    expect(byId(h.r, 'revive-button')).toBeDefined();
    expect(byId(h.r, 'revive-restart')).toBeDefined();
    expect(host(h, 'revive-seconds')?.props.children).toBe(REVIVE_COUNTDOWN_S);
    expect(dump(h.r)).toContain('players can pass this level');
    expect(dump(h.r)).toContain('Tap to restart');
    // Still the game screen, not the result screen.
    expect(dump(h.r)).not.toContain('Tray full');
  });

  it('counts down and then shows the failed result', async () => {
    const h = await loseALevel(500);
    await advance(2000);
    expect(
      Number(host(h, 'revive-seconds')?.props.children),
    ).toBeLessThanOrEqual(3);
    await advance(REVIVE_COUNTDOWN_S * 1000);
    expect(dump(h.r)).toContain('Tray full');
    expect(host(h, 'revive-overlay')).toBeUndefined();
  });

  const loseAgain = async (h: Harness) => {
    for (const id of [13, 16, 19]) {
      await press(h.r, `tile-${id}`);
    }
  };

  it('the first Revive is free and puts the game back in play', async () => {
    const h = await loseALevel(500);
    expect(host(h, 'revive-cost')).toBeUndefined();
    await press(h.r, 'revive-button');
    expect(coinsOf(h)).toBe(500);
    expect(host(h, 'revive-overlay')).toBeUndefined();
    expect(dump(h.r)).toContain('Tray, 4 of 7 slots used');
    // The countdown no longer ends the level.
    await advance(REVIVE_COUNTDOWN_S * 1000 + 1000);
    expect(dump(h.r)).not.toContain('Tray full');
    expect(h.analytics.events.map(e => e.name)).toContain('level_revive');
  });

  it('a second Revive on the same attempt costs coins', async () => {
    const h = await loseALevel(500);
    await press(h.r, 'revive-button');
    await loseAgain(h);
    expect(host(h, 'revive-overlay')).toBeDefined();
    expect(host(h, 'revive-cost')).toBeDefined();
    await press(h.r, 'revive-button');
    expect(coinsOf(h)).toBe(500 - REVIVE_COST);
    expect(host(h, 'revive-overlay')).toBeUndefined();
  });

  it('says so, and spends nothing, when there are too few coins for a second one', async () => {
    const h = await loseALevel(REVIVE_COST - 1);
    await press(h.r, 'revive-button');
    await loseAgain(h);
    await press(h.r, 'revive-button');
    expect(dump(h.r)).toContain('Not enough coins to revive.');
    expect(coinsOf(h)).toBe(REVIVE_COST - 1);
    expect(host(h, 'revive-overlay')).toBeDefined();
  });

  it('Tap to restart starts the level again at once', async () => {
    const h = await loseALevel(500);
    await press(h.r, 'revive-restart');
    expect(dump(h.r)).toContain('Score 0');
    expect(host(h, 'revive-overlay')).toBeUndefined();
    expect(coinsOf(h)).toBe(500);
  });
});

describe('lose screen layout in a narrow column', () => {
  it('centres the ring, bird and button on the space it is given, not the window', async () => {
    const h = await loseALevel(500);
    const overlay = host(h, 'revive-overlay');
    expect(overlay).toBeDefined();
    // The web build shows the game in a column much narrower than the window.
    const { act } = require('react-test-renderer');
    await act(async () => {
      overlay?.props.onLayout({
        nativeEvent: { layout: { width: 400, height: 800 } },
      });
    });
    const flat = (style: unknown): Record<string, number> & { width: number } =>
      Object.assign({}, ...[style].flat(Infinity).filter(Boolean));
    const ring = flat(host(h, 'revive-ring')?.props.style);
    expect(ring.left).toBe((400 - 190) / 2);
    const button = flat(
      byId(h.r, 'revive-button')?.props.style({ pressed: false }),
    );
    expect(button.left).toBe((400 - button.width) / 2);
    expect(button.width).toBeLessThanOrEqual(400 * 0.68);
  });
});
