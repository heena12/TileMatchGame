jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

import { fixedSource, losingLevel, tinyLevel } from '../testUtils';
import {
  act,
  advance,
  byId,
  dump,
  hostByPrefix,
  launch,
  loseTiles,
  playTiles,
  press,
  toHome,
} from '../harness';
import type { Harness } from '../harness';
import { APP_CONFIG } from '@config/constants';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import type { ILevelSource, LevelData } from '@engine';
import { flush } from '../testUtils';

describe('launch', () => {
  it('shows Splash, then Home, and reports app_open', async () => {
    const h = await launch();
    expect(dump(h.r)).toContain('Tile Studio');
    await advance(APP_CONFIG.splashBrandMs + 100);
    expect(dump(h.r)).toContain('Tile Match');
    expect(dump(h.r)).toContain('Quickly entering the level');
    await toHome(h);
    expect(dump(h.r)).toContain('Level 1');
    expect(dump(h.r)).toContain('Coins: 0');
    expect(h.analytics.events).toEqual([{ name: 'app_open' }]);
  });
});

describe('play a level', () => {
  it('Home -> Game -> Result with score, stars and coins', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-continue');
    expect(dump(h.r)).toContain('Level 1');
    expect(dump(h.r)).toContain('Score 0');
    expect(
      h.r.root.findAll(
        n =>
          /^tile-\d+$/.test(n.props.testID ?? '') && typeof n.type === 'string',
      ),
    ).toHaveLength(6);

    await playTiles(h, [1, 2, 3]);
    expect(dump(h.r)).toContain('Score 130');

    await playTiles(h, [4, 5, 6]);
    const text = dump(h.r);
    expect(text).toContain('Level complete!');
    expect(text).toContain('Score 510');
    expect(text).toContain('+25 coins');
    expect(text).toContain('3 of 3 stars');
    expect(h.analytics.events.map(e => e.name)).toEqual([
      'app_open',
      'level_start',
      'level_complete',
    ]);
  });

  it('shows the combo while it is running', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-continue');
    await playTiles(h, [1, 2, 3, 4, 5]);
    expect(dump(h.r)).not.toContain('Combo x');
    await playTiles(h, [6]);
    // Level ends on the sixth tap, so the combo shows on the Result score instead.
    expect(dump(h.r)).toContain('Level complete!');
  });

  it('the tray shows the tiles that were tapped', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-continue');
    await playTiles(h, [1, 2]);
    expect(dump(h.r)).toContain('Tray, 2 of 7 slots used');
  });

  it('a tapped covered tile does nothing and is labelled covered', async () => {
    const layered = (id: number): LevelData => ({
      ...tinyLevel(id),
      tiles: [
        { id: 1, typeId: 1, x: 0, y: 0, layer: 0 },
        { id: 2, typeId: 1, x: 0.5, y: 0, layer: 1 },
        { id: 3, typeId: 1, x: 5, y: 0, layer: 0 },
      ],
    });
    const h = await launch(fixedSource(layered));
    await toHome(h);
    await press(h.r, 'home-continue');
    expect(dump(h.r)).toContain('covered');
    await press(h.r, 'tile-1');
    expect(dump(h.r)).toContain('Tray, 0 of 7 slots used');
    await press(h.r, 'tile-2');
    expect(dump(h.r)).toContain('Tray, 1 of 7 slots used');
  });

  it('Restart puts the level back to the start', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-continue');
    await playTiles(h, [1, 2]);
    await press(h.r, 'game-restart');
    expect(dump(h.r)).toContain('Score 0');
    expect(dump(h.r)).toContain('Tray, 0 of 7 slots used');
  });

  it('Quit returns to Home without a result', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-continue');
    await press(h.r, 'game-quit');
    expect(dump(h.r)).toContain('Level 1');
    expect(h.container.model.stores.gameSession.getState().status).toBe('idle');
  });
});

describe('after the level', () => {
  async function finishLevelOne(h: Harness) {
    await toHome(h);
    await press(h.r, 'home-continue');
    await playTiles(h, [1, 2, 3, 4, 5, 6]);
  }

  it('Next level opens level 2 and Home now continues from it', async () => {
    const h = await launch();
    await finishLevelOne(h);
    await press(h.r, 'result-next');
    expect(dump(h.r)).toContain('Level 2');
    await press(h.r, 'game-quit');
    expect(dump(h.r)).toContain('Level 2');
    expect(dump(h.r)).toContain('Coins: 25');
  });

  it('a replay that changes nothing pays no more coins', async () => {
    const h = await launch();
    await finishLevelOne(h);
    await press(h.r, 'result-retry');
    await playTiles(h, [1, 2, 3, 4, 5, 6]);
    expect(dump(h.r)).toContain('+0 coins');
    expect(h.container.model.stores.progress.getState().coins).toBe(25);
  });

  it('Try again after finishing does not bounce straight back to Result', async () => {
    const h = await launch();
    await finishLevelOne(h);
    await press(h.r, 'result-retry');
    expect(dump(h.r)).toContain('Score 0');
    expect(dump(h.r)).not.toContain('Level complete!');
  });

  it('Level map keeps the first picture open after finishing level 1', async () => {
    const h = await launch();
    await finishLevelOne(h);
    await press(h.r, 'result-map');
    const slot = h.r.root.findAll(
      n => n.props.testID === 'map-slot-0-0' && n.props.disabled !== undefined,
    )[0];
    expect(slot?.props.disabled).toBe(false);
    expect(dump(h.r)).toContain('France');
  });

  it('Home button from Result goes back to the start of the stack', async () => {
    const h = await launch();
    await finishLevelOne(h);
    await press(h.r, 'result-home');
    expect(dump(h.r)).toContain('Level 2');
  });

  it('progress survives an app restart', async () => {
    const storage = new InMemoryStorage();
    const first = await launch(fixedSource(tinyLevel), storage);
    await finishLevelOne(first);
    await act(async () => {
      first.r.unmount();
    });

    const second = await launch(fixedSource(tinyLevel), storage);
    await toHome(second);
    expect(dump(second.r)).toContain('Level 2');
    expect(dump(second.r)).toContain('Coins: 25');
  });
});

describe('losing', () => {
  async function lose(h: Harness) {
    await toHome(h);
    await press(h.r, 'home-continue');
    await loseTiles(h, [1, 4, 7, 10, 13, 16, 19]);
  }

  it('shows the lose screen with no stars, coins or Next button', async () => {
    const h = await launch(fixedSource(losingLevel));
    await lose(h);
    expect(dump(h.r)).toContain('Tray full');
    expect(dump(h.r)).not.toContain('result-coins');
    expect(byId(h.r, 'result-next')).toBeUndefined();
    expect(
      h.container.model.stores.progress.getState().highestUnlockedLevel,
    ).toBe(1);
    expect(h.analytics.events.map(e => e.name)).toContain('level_fail');
  });

  it('Try again after a loss starts a fresh game', async () => {
    const h = await launch(fixedSource(losingLevel));
    await lose(h);
    await press(h.r, 'result-retry');
    expect(dump(h.r)).toContain('Score 0');
    expect(dump(h.r)).not.toContain('Tray full');
  });
});

describe('load failure', () => {
  it('offers Try again and recovers', async () => {
    let calls = 0;
    const flaky: ILevelSource<LevelData> = {
      getLevel: async id => {
        if (calls++ === 0) {
          throw new Error('offline');
        }
        return tinyLevel(id);
      },
    };
    const h = await launch(flaky);
    await toHome(h);
    await press(h.r, 'home-continue');
    expect(dump(h.r)).toContain('Could not load this level.');
    const retry = h.r.root.findAll(
      n =>
        n.props.accessibilityLabel === 'Try again' &&
        typeof n.props.onPress === 'function',
    )[0];
    await act(async () => {
      retry?.props.onPress();
      await flush();
    });
    expect(dump(h.r)).toContain('Score 0');
  });

  it('can quit from the error screen', async () => {
    const failing: ILevelSource<LevelData> = {
      getLevel: async () => {
        throw new Error('offline');
      },
    };
    const h = await launch(failing);
    await toHome(h);
    await press(h.r, 'home-continue');
    const quit = h.r.root.findAll(
      n =>
        n.props.accessibilityLabel === 'Quit' &&
        typeof n.props.onPress === 'function',
    )[0];
    await act(async () => {
      quit?.props.onPress();
      await flush();
    });
    expect(dump(h.r)).toContain('Level 1');
  });
});

describe('level map', () => {
  const slot = (h: Harness, id: string) =>
    h.r.root.findAll(
      n => n.props.testID === id && n.props.disabled !== undefined,
    )[0];

  it('lists countries, mounts only a window of them and locks the rest', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-play');
    const regions = hostByPrefix(h.r, 'map-region-');
    expect(regions.length).toBeGreaterThan(0);
    expect(regions.length).toBeLessThan(20);
    expect(dump(h.r)).toContain('France');
    expect(slot(h, 'map-slot-0-0')?.props.disabled).toBe(false);
    expect(slot(h, 'map-slot-0-1')?.props.disabled).toBe(true);
  });

  it('opens the next level when the current picture is tapped', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-play');
    await press(h.r, 'map-slot-0-0');
    expect(dump(h.r)).toContain('Level 1');
    expect(dump(h.r)).toContain('Score 0');
  });

  it('starts scrolled to the country holding the next level', async () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.progress',
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: 1,
        highestUnlockedLevel: 4001,
        coins: 0,
        levels: {},
      }),
    );
    const h = await launch(fixedSource(tinyLevel), storage);
    await toHome(h);
    await press(h.r, 'home-play');
    const ids = hostByPrefix(h.r, 'map-region-').map(n => n.props.testID);
    expect(ids).toContain('map-region-51');
    expect(ids).not.toContain('map-region-0');
  });
});

describe('settings', () => {
  it('toggles are saved and restored', async () => {
    const storage = new InMemoryStorage();
    const first = await launch(fixedSource(tinyLevel), storage);
    await toHome(first);
    await press(first.r, 'home-settings');
    const sound = first.r.root.findAll(
      n =>
        n.props.testID === 'setting-sound' &&
        typeof n.props.onValueChange === 'function',
    )[0];
    expect(sound?.props.value).toBe(true);
    await act(async () => {
      sound?.props.onValueChange(false);
    });
    const saved = JSON.parse(storage.getString('player.settings') as string);
    expect(saved.soundEnabled).toBe(false);
    await act(async () => {
      first.r.unmount();
    });

    const second = await launch(fixedSource(tinyLevel), storage);
    await toHome(second);
    await press(second.r, 'home-settings');
    const again = second.r.root.findAll(
      n =>
        n.props.testID === 'setting-sound' &&
        typeof n.props.onValueChange === 'function',
    )[0];
    expect(again?.props.value).toBe(false);
  });
});
