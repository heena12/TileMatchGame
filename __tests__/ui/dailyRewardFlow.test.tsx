jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

import { DAILY_REWARDS } from '@config/dailyReward';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { dayNumber } from '@state/daily/dailyReward';
import { hostByPrefix, launch, press, toHome } from '../harness';
import type { Harness } from '../harness';
import { fixedSource, tinyLevel } from '../testUtils';

const has = (h: Harness, id: string) =>
  hostByPrefix(h.r, id).some(n => n.props.testID === id);

const seeded = (
  over: Record<string, unknown> = {},
  tutorialCompleted = true,
) => {
  const storage = new InMemoryStorage();
  storage.setString(
    'player.progress',
    JSON.stringify({
      schemaVersion: 3,
      updatedAt: 1,
      highestUnlockedLevel: 30,
      levels: {},
      wallet: { coins: 100 },
      inventory: {},
      tutorialCompleted,
      dailyReward: { lastClaimDay: null, streak: 0 },
      ...over,
    }),
  );
  return storage;
};

const saved = (storage: InMemoryStorage) =>
  JSON.parse(storage.getString('player.progress') as string);

describe('daily reward on the Home screen', () => {
  it('shows the gift with a badge when a reward is waiting', async () => {
    const h = await launch(fixedSource(tinyLevel), seeded());
    await toHome(h);
    expect(has(h, 'home-daily')).toBe(true);
    expect(has(h, 'home-daily-badge')).toBe(true);
  });

  it('is hidden while the tutorial is not finished', async () => {
    const h = await launch(fixedSource(tinyLevel), seeded({}, false));
    await toHome(h);
    expect(has(h, 'home-daily')).toBe(false);
  });

  it("claims today's reward into the wallet and saves it", async () => {
    const storage = seeded();
    const h = await launch(fixedSource(tinyLevel), storage);
    await toHome(h);
    await press(h.r, 'home-daily');
    expect(has(h, 'daily-modal')).toBe(true);
    expect(has(h, 'daily-claim')).toBe(true);

    await press(h.r, 'daily-claim');
    expect(has(h, 'daily-received')).toBe(true);
    expect(has(h, 'daily-claim')).toBe(false);
    const doc = saved(storage);
    expect(doc.wallet.coins).toBe(100 + (DAILY_REWARDS[0]?.coins ?? 0));
    expect(doc.dailyReward.streak).toBe(1);
    expect(doc.dailyReward.lastClaimDay).toBe(dayNumber(Date.now()));
  });

  it('drops the badge after claiming and says to come back tomorrow', async () => {
    const h = await launch(fixedSource(tinyLevel), seeded());
    await toHome(h);
    await press(h.r, 'home-daily');
    await press(h.r, 'daily-claim');
    await press(h.r, 'daily-close');
    expect(has(h, 'home-daily-badge')).toBe(false);
    await press(h.r, 'home-daily');
    expect(has(h, 'daily-wait')).toBe(true);
    expect(has(h, 'daily-claim')).toBe(false);
  });

  it('cannot claim twice in one day', async () => {
    const storage = seeded({
      dailyReward: { lastClaimDay: dayNumber(Date.now()), streak: 3 },
    });
    const h = await launch(fixedSource(tinyLevel), storage);
    await toHome(h);
    expect(has(h, 'home-daily-badge')).toBe(false);
    await press(h.r, 'home-daily');
    expect(has(h, 'daily-claim')).toBe(false);
    expect(saved(storage).wallet.coins).toBe(100);
  });

  it('continues a streak from yesterday', async () => {
    const storage = seeded({
      dailyReward: { lastClaimDay: dayNumber(Date.now()) - 1, streak: 2 },
    });
    const h = await launch(fixedSource(tinyLevel), storage);
    await toHome(h);
    await press(h.r, 'home-daily');
    await press(h.r, 'daily-claim');
    expect(saved(storage).dailyReward.streak).toBe(3);
    expect(saved(storage).wallet.coins).toBe(
      100 + (DAILY_REWARDS[2]?.coins ?? 0),
    );
  });

  it('opens by itself the first time Home is shown', async () => {
    const h = await launch(fixedSource(tinyLevel), seeded());
    await toHome(h);
    expect(has(h, 'daily-modal')).toBe(true);
  });

  it('does not reopen after it is closed without claiming', async () => {
    const h = await launch(fixedSource(tinyLevel), seeded());
    await toHome(h);
    await press(h.r, 'daily-close');
    expect(has(h, 'daily-modal')).toBe(false);
    expect(has(h, 'home-daily-badge')).toBe(true);
  });

  it('does not open by itself when there is nothing to claim', async () => {
    const h = await launch(
      fixedSource(tinyLevel),
      seeded({
        dailyReward: { lastClaimDay: dayNumber(Date.now()), streak: 1 },
      }),
    );
    await toHome(h);
    expect(has(h, 'daily-modal')).toBe(false);
  });

  it('does not open by itself during the tutorial', async () => {
    const h = await launch(fixedSource(tinyLevel), seeded({}, false));
    await toHome(h);
    expect(has(h, 'daily-modal')).toBe(false);
  });
});
