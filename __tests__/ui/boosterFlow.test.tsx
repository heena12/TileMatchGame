import { generateLevel } from '@engine';
import { BOOSTER_PRICES } from '@config/boosters';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { advance, dump, hostByPrefix, launch, press, toHome } from '../harness';
import type { Harness } from '../harness';
import { createLevelSource } from '@services/levels/createLevelSource';
import { fixedSource } from '../testUtils';

jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

const stocked = (inventory: Record<string, number>, coins = 0) => {
  const storage = new InMemoryStorage();
  storage.setString(
    'player.progress',
    JSON.stringify({
      schemaVersion: 2,
      updatedAt: 1,
      highestUnlockedLevel: 30,
      levels: {},
      wallet: { coins },
      inventory,
      tutorialCompleted: true,
    }),
  );
  return storage;
};

async function startGame(h: Harness) {
  await toHome(h);
  await press(h.r, 'home-continue');
}

const badge = (h: Harness, kind: string) => {
  const text = hostByPrefix(h.r, `booster-${kind}-badge`)[0]?.props.children;
  return Array.isArray(text) ? text.join('') : String(text);
};

const labelOf = (h: Harness, kind: string) =>
  h.r.root.findAll(
    n => n.props.testID === `booster-${kind}` && n.props.accessibilityLabel,
  )[0]?.props.accessibilityLabel;

describe('the booster bar', () => {
  it('shows the three boosters with how many are left', async () => {
    const h = await launch(
      undefined,
      stocked({ undo: 2, hint: 1, shuffle: 3 }),
    );
    await startGame(h);
    expect(badge(h, 'undo')).toBe('2');
    expect(badge(h, 'hint')).toBe('1');
    expect(badge(h, 'shuffle')).toBe('3');
    expect(labelOf(h, 'undo')).toBe('Undo, 2 left');
  });

  it('shows the price in coins for a booster with none in stock', async () => {
    const h = await launch(undefined, stocked({}, 500));
    await startGame(h);
    expect(badge(h, 'undo')).toBe(String(BOOSTER_PRICES.undo));
    expect(badge(h, 'hint')).toBe(String(BOOSTER_PRICES.hint));
    expect(badge(h, 'shuffle')).toBe(String(BOOSTER_PRICES.shuffle));
    expect(labelOf(h, 'shuffle')).toBe(
      `Shuffle, costs ${BOOSTER_PRICES.shuffle} coins`,
    );
  });
});

describe('Undo on screen', () => {
  it('takes the tile back, gives the points back, and uses one from stock', async () => {
    const h = await launch(undefined, stocked({ undo: 2 }));
    await startGame(h);
    await press(h.r, 'tile-1');
    await press(h.r, 'tile-2');
    expect(dump(h.r)).toContain('Score 20');

    await press(h.r, 'booster-undo');
    expect(dump(h.r)).toContain('Score 10');
    expect(dump(h.r)).toContain('Tray, 1 of 7 slots used');
    expect(badge(h, 'undo')).toBe('1');
    expect(h.audio.played.at(-1)).toBe('undo');
  });

  it('lets the same tile be tapped again afterwards', async () => {
    const h = await launch(undefined, stocked({ undo: 1 }));
    await startGame(h);
    await press(h.r, 'tile-1');
    await press(h.r, 'booster-undo');
    expect(dump(h.r)).toContain('Tray, 0 of 7 slots used');
    await press(h.r, 'tile-1');
    expect(dump(h.r)).toContain('Tray, 1 of 7 slots used');
  });

  it('says so, and costs nothing, when there is nothing to undo', async () => {
    const h = await launch(undefined, stocked({ undo: 1 }));
    await startGame(h);
    await press(h.r, 'booster-undo');
    expect(dump(h.r)).toContain('Nothing to undo yet');
    expect(badge(h, 'undo')).toBe('1');
  });

  it('buys one with coins when none is in stock', async () => {
    const h = await launch(undefined, stocked({}, 100));
    await startGame(h);
    await press(h.r, 'tile-1');
    await press(h.r, 'booster-undo');
    expect(dump(h.r)).toContain('Tray, 0 of 7 slots used');
    expect(h.container.model.stores.progress.getState().coins).toBe(
      100 - BOOSTER_PRICES.undo,
    );
  });

  it('says there are not enough coins, and changes nothing', async () => {
    const h = await launch(undefined, stocked({}, BOOSTER_PRICES.undo - 1));
    await startGame(h);
    await press(h.r, 'tile-1');
    await press(h.r, 'booster-undo');
    expect(dump(h.r)).toContain('Not enough coins');
    expect(dump(h.r)).toContain('Tray, 1 of 7 slots used');
    expect(h.container.model.stores.progress.getState().coins).toBe(
      BOOSTER_PRICES.undo - 1,
    );
  });

  it('the message fades after a moment', async () => {
    const h = await launch(undefined, stocked({ undo: 1 }));
    await startGame(h);
    await press(h.r, 'booster-undo');
    expect(hostByPrefix(h.r, 'booster-message')).toHaveLength(1);
    await advance(2500);
    expect(hostByPrefix(h.r, 'booster-message')).toHaveLength(0);
  });

  it('a successful use clears an earlier message', async () => {
    const h = await launch(undefined, stocked({ undo: 2 }));
    await startGame(h);
    await press(h.r, 'booster-undo');
    expect(hostByPrefix(h.r, 'booster-message')).toHaveLength(1);
    await press(h.r, 'tile-1');
    await press(h.r, 'booster-undo');
    expect(hostByPrefix(h.r, 'booster-message')).toHaveLength(0);
  });
});

describe('Wand on screen', () => {
  it('glows the set, then sends it to the tray and clears it', async () => {
    const h = await launch(undefined, stocked({ hint: 1 }));
    await startGame(h);
    await press(h.r, 'booster-hint');
    expect(hostByPrefix(h.r, 'wand-ring-')).toHaveLength(3);
    expect(badge(h, 'hint')).toBe(String(BOOSTER_PRICES.hint));

    await advance(2000);
    expect(hostByPrefix(h.r, 'wand-ring-')).toHaveLength(0);
    expect(hostByPrefix(h.r, 'tile-')).toHaveLength(3);
  });

  it('plays the sparkle cue and is not confused with the tutorial highlight', async () => {
    const h = await launch(undefined, stocked({ hint: 1 }));
    await startGame(h);
    await press(h.r, 'booster-hint');
    expect(h.audio.played).toContain('hint');
    expect(hostByPrefix(h.r, 'tutorial-ring-')).toHaveLength(0);
  });
});

describe('Shuffle on screen', () => {
  const big = fixedSource(() => generateLevel(120));

  it('re-deals the board, keeps the score, and uses one', async () => {
    const h = await launch(big, stocked({ shuffle: 1 }));
    await startGame(h);
    const before = h.container.model.stores.gameSession
      .getState()
      .game?.board.map(t => t.typeId);
    await press(h.r, 'booster-shuffle');
    const after = h.container.model.stores.gameSession
      .getState()
      .game?.board.map(t => t.typeId);
    expect(after).not.toEqual(before);
    expect(dump(h.r)).toContain('Score 0');
    expect(badge(h, 'shuffle')).toBe(String(BOOSTER_PRICES.shuffle));
    expect(h.audio.played.at(-1)).toBe('shuffle');
  });

  it('says so when only one picture is left', async () => {
    const h = await launch(undefined, stocked({ shuffle: 1 }));
    await startGame(h);
    for (const id of [1, 2, 3]) {
      await press(h.r, `tile-${id}`);
    }
    await press(h.r, 'booster-shuffle');
    expect(dump(h.r)).toContain('Nothing to shuffle');
    expect(badge(h, 'shuffle')).toBe('1');
  });
});

describe('boosters and the rest of the app', () => {
  it('are held back during a tutorial step, with a reason, and cost nothing', async () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.progress',
      JSON.stringify({
        schemaVersion: 2,
        updatedAt: 1,
        highestUnlockedLevel: 1,
        levels: {},
        wallet: { coins: 200 },
        inventory: { hint: 2 },
        tutorialCompleted: false,
      }),
    );
    const h = await launch(createLevelSource(), storage);
    await startGame(h);
    expect(dump(h.r)).toContain('Welcome!');
    await press(h.r, 'booster-hint');
    expect(dump(h.r)).toContain('Finish this tutorial step first');
    expect(badge(h, 'hint')).toBe('2');
    expect(h.container.model.stores.progress.getState().coins).toBe(200);
  });

  it('what was used stays used after the app is reopened', async () => {
    const storage = stocked({ undo: 2 });
    const first = await launch(undefined, storage);
    await startGame(first);
    await press(first.r, 'tile-1');
    await press(first.r, 'booster-undo');
    const second = await launch(undefined, storage);
    await startGame(second);
    expect(badge(second, 'undo')).toBe('1');
  });

  it('a resumed game keeps its undo history and boosters used', async () => {
    const storage = stocked({ undo: 2 });
    const first = await launch(undefined, storage);
    await startGame(first);
    await press(first.r, 'tile-1');
    await press(first.r, 'tile-2');
    const second = await launch(undefined, storage);
    await toHome(second);
    await press(second.r, 'home-resume');
    expect(dump(second.r)).toContain('Tray, 2 of 7 slots used');
    await press(second.r, 'booster-undo');
    expect(dump(second.r)).toContain('Tray, 1 of 7 slots used');
  });

  it('are used up front by new players who finish the tutorial: one of each', async () => {
    const h = await launch();
    h.container.model.stores.progress.getState().completeTutorial();
    await startGame(h);
    expect(badge(h, 'undo')).toBe('1');
    expect(badge(h, 'hint')).toBe('1');
    expect(badge(h, 'shuffle')).toBe('1');
  });
});
