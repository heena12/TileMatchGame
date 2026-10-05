import {
  BOOSTER_KINDS,
  BOOSTER_PRICES,
  STARTER_BOOSTERS,
  isBoosterKind,
} from '@config/boosters';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { createProgressStore } from '@state/progressStore';

const clock = (start = 100) => {
  let now = start;
  return { now: () => now++ };
};

const fresh = () => {
  const storage = new InMemoryStorage();
  return { storage, store: createProgressStore(storage, clock()) };
};

const stocked = (inventory: Record<string, number>, coins = 0) => {
  const storage = new InMemoryStorage();
  storage.setString(
    'player.progress',
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: 1,
      highestUnlockedLevel: 20,
      levels: {},
      wallet: { coins },
      inventory,
      tutorialCompleted: true,
    }),
  );
  return { storage, store: createProgressStore(storage, clock()) };
};

describe('booster configuration', () => {
  it('has the three boosters, each with a price', () => {
    expect([...BOOSTER_KINDS]).toEqual(['undo', 'shuffle', 'hint']);
    BOOSTER_KINDS.forEach(kind => {
      expect(BOOSTER_PRICES[kind]).toBeGreaterThan(0);
      expect(Number.isInteger(BOOSTER_PRICES[kind])).toBe(true);
    });
  });

  it('prices the stronger boosters higher', () => {
    expect(BOOSTER_PRICES.hint).toBeLessThan(BOOSTER_PRICES.undo);
    expect(BOOSTER_PRICES.undo).toBeLessThan(BOOSTER_PRICES.shuffle);
  });

  it('recognises booster names', () => {
    expect(isBoosterKind('undo')).toBe(true);
    expect(isBoosterKind('rocket')).toBe(false);
  });
});

describe('credit (the one way rewards, ads and purchases add to the wallet)', () => {
  it('adds coins', () => {
    const { store } = fresh();
    store.getState().credit({ coins: 120 });
    expect(store.getState().coins).toBe(120);
  });

  it('adds boosters to the inventory', () => {
    const { store } = fresh();
    store.getState().credit({ boosters: { undo: 2, hint: 1 } });
    expect(store.getState().inventory).toEqual({ undo: 2, hint: 1 });
  });

  it('adds both at once and stacks with what is there', () => {
    const { store } = stocked({ undo: 1 }, 10);
    store.getState().credit({ coins: 5, boosters: { undo: 2, shuffle: 1 } });
    expect(store.getState()).toMatchObject({
      coins: 15,
      inventory: { undo: 3, shuffle: 1 },
    });
  });

  it.each([
    ['negative coins', { coins: -50 }],
    ['fractional coins', { coins: 2.5 }],
    ['zero', { coins: 0 }],
    ['nothing', {}],
    ['negative boosters', { boosters: { undo: -1 } }],
    ['fractional boosters', { boosters: { hint: 0.5 } }],
  ])('ignores %s and does not even save', (_name, grant) => {
    const { storage, store } = fresh();
    store.getState().credit(grant);
    expect(store.getState().coins).toBe(0);
    expect(store.getState().inventory).toEqual({});
    expect(storage.contains('player.progress')).toBe(false);
  });

  it('keeps a valid part of a mixed grant', () => {
    const { store } = fresh();
    store.getState().credit({ coins: -5, boosters: { undo: 2 } });
    expect(store.getState().coins).toBe(0);
    expect(store.getState().inventory).toEqual({ undo: 2 });
  });

  it('is saved and survives a restart', () => {
    const { storage, store } = fresh();
    store.getState().credit({ coins: 40, boosters: { shuffle: 3 } });
    const again = createProgressStore(storage, clock()).getState();
    expect(again.coins).toBe(40);
    expect(again.inventory).toEqual({ shuffle: 3 });
  });

  it('stamps the time', () => {
    const storage = new InMemoryStorage();
    const store = createProgressStore(storage, clock(8000));
    store.getState().credit({ coins: 1 });
    expect(store.getState().updatedAt).toBe(8000);
  });
});

describe('canAfford and payForBooster', () => {
  it('cannot afford anything with an empty wallet', () => {
    const { store } = fresh();
    BOOSTER_KINDS.forEach(kind =>
      expect(store.getState().canAfford(kind)).toBe(false),
    );
    expect(store.getState().payForBooster('undo')).toBeNull();
  });

  it('uses stock first and takes exactly one', () => {
    const { store } = stocked({ undo: 2 }, 1000);
    expect(store.getState().canAfford('undo')).toBe(true);
    expect(store.getState().payForBooster('undo')).toBe('inventory');
    expect(store.getState().inventory.undo).toBe(1);
    expect(store.getState().coins).toBe(1000);
  });

  it('pays coins when there is no stock', () => {
    const { store } = stocked({}, 100);
    expect(store.getState().payForBooster('shuffle')).toBe('coins');
    expect(store.getState().coins).toBe(100 - BOOSTER_PRICES.shuffle);
    expect(store.getState().inventory.shuffle ?? 0).toBe(0);
  });

  it('pays coins once the stock has run out', () => {
    const { store } = stocked({ hint: 1 }, 100);
    expect(store.getState().payForBooster('hint')).toBe('inventory');
    expect(store.getState().payForBooster('hint')).toBe('coins');
    expect(store.getState().coins).toBe(100 - BOOSTER_PRICES.hint);
  });

  it('can afford exactly the price, but not one coin less', () => {
    expect(
      stocked({}, BOOSTER_PRICES.undo).store.getState().canAfford('undo'),
    ).toBe(true);
    expect(
      stocked({}, BOOSTER_PRICES.undo - 1)
        .store.getState()
        .canAfford('undo'),
    ).toBe(false);
  });

  it('refuses without changing anything when it cannot pay', () => {
    const { storage, store } = stocked({}, BOOSTER_PRICES.undo - 1);
    const saved = storage.getString('player.progress');
    expect(store.getState().payForBooster('undo')).toBeNull();
    expect(store.getState().coins).toBe(BOOSTER_PRICES.undo - 1);
    expect(storage.getString('player.progress')).toBe(saved);
  });

  it('never lets coins or stock go negative', () => {
    const { store } = stocked({ undo: 1 }, BOOSTER_PRICES.undo);
    store.getState().payForBooster('undo');
    store.getState().payForBooster('undo');
    store.getState().payForBooster('undo');
    expect(store.getState().coins).toBe(0);
    expect(store.getState().inventory.undo).toBe(0);
  });

  it('each booster is paid for from its own stock', () => {
    const { store } = stocked({ undo: 1 }, 0);
    expect(store.getState().canAfford('undo')).toBe(true);
    expect(store.getState().canAfford('hint')).toBe(false);
  });

  it('payment is saved', () => {
    const { storage, store } = stocked({ undo: 1 }, 0);
    store.getState().payForBooster('undo');
    const doc = JSON.parse(storage.getString('player.progress') as string);
    expect(doc.inventory.undo).toBe(0);
  });
});

describe('starter boosters', () => {
  it('are given when the tutorial is skipped', () => {
    const { store } = fresh();
    store.getState().completeTutorial();
    expect(store.getState().inventory).toEqual({ ...STARTER_BOOSTERS });
  });

  it('are given when the last tutorial level is cleared', () => {
    const { store } = fresh();
    store
      .getState()
      .recordResult({ levelId: 10, stars: 1, score: 1, coins: 15 });
    expect(store.getState().inventory).toEqual({ ...STARTER_BOOSTERS });
    expect(store.getState().coins).toBe(15);
  });

  it('are given only once, however the tutorial ends', () => {
    const { store } = fresh();
    store.getState().completeTutorial();
    store.getState().completeTutorial();
    store
      .getState()
      .recordResult({ levelId: 10, stars: 3, score: 1, coins: 0 });
    store
      .getState()
      .recordResult({ levelId: 11, stars: 1, score: 1, coins: 0 });
    expect(store.getState().inventory).toEqual({ ...STARTER_BOOSTERS });
  });

  it('are not given for clearing an early level', () => {
    const { store } = fresh();
    store
      .getState()
      .recordResult({ levelId: 3, stars: 3, score: 1, coins: 25 });
    expect(store.getState().inventory).toEqual({});
  });

  it('are not given again to someone whose save already finished the tutorial', () => {
    const { store } = stocked({}, 0);
    store
      .getState()
      .recordResult({ levelId: 30, stars: 1, score: 1, coins: 0 });
    expect(store.getState().inventory).toEqual({});
  });

  it('add to boosters the player already has', () => {
    const { store } = fresh();
    store.getState().credit({ boosters: { undo: 5 } });
    store.getState().completeTutorial();
    expect(store.getState().inventory.undo).toBe(5 + STARTER_BOOSTERS.undo);
  });

  it('are saved with the tutorial flag', () => {
    const { storage, store } = fresh();
    store.getState().completeTutorial();
    const again = createProgressStore(storage, clock()).getState();
    expect(again.tutorialCompleted).toBe(true);
    expect(again.inventory).toEqual({ ...STARTER_BOOSTERS });
  });
});

describe('buyBooster (shop)', () => {
  it('spends the price and adds one to the stock', () => {
    const { store } = stocked({}, 100);
    expect(store.getState().buyBooster('undo')).toBe(true);
    expect(store.getState().coins).toBe(100 - BOOSTER_PRICES.undo);
    expect(store.getState().inventory.undo).toBe(1);
  });

  it('changes nothing when the coins are short', () => {
    const { store } = stocked({}, BOOSTER_PRICES.hint - 1);
    expect(store.getState().buyBooster('hint')).toBe(false);
    expect(store.getState().coins).toBe(BOOSTER_PRICES.hint - 1);
    expect(store.getState().inventory.hint ?? 0).toBe(0);
  });
});

describe('spendCoins (revive)', () => {
  it('spends exactly what is asked when there is enough', () => {
    const { store } = stocked({}, 150);
    expect(store.getState().spendCoins(100)).toBe(true);
    expect(store.getState().coins).toBe(50);
  });

  it('changes nothing when the coins are short or the amount is odd', () => {
    const { store } = stocked({}, 99);
    expect(store.getState().spendCoins(100)).toBe(false);
    expect(store.getState().spendCoins(-5)).toBe(false);
    expect(store.getState().spendCoins(1.5)).toBe(false);
    expect(store.getState().coins).toBe(99);
  });
});
