import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { fixedSource, losingLevel, tinyLevel } from '../testUtils';
import {
  act,
  byId,
  dump,
  launch,
  loseTiles,
  playTiles,
  press,
  toHome,
} from '../harness';
import type { Harness } from '../harness';

jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

const source = fixedSource(tinyLevel);

async function playSomeAndCloseApp(ids: number[] = [1, 2, 4]) {
  const storage = new InMemoryStorage();
  const first = await launch(source, storage);
  await toHome(first);
  await press(first.r, 'home-continue');
  for (const id of ids) {
    await press(first.r, `tile-${id}`);
  }
  // The app is closed without pressing Quit.
  await act(async () => {
    first.r.unmount();
  });
  return storage;
}

async function reopen(storage: InMemoryStorage): Promise<Harness> {
  const h = await launch(source, storage);
  await toHome(h);
  return h;
}

describe('Resume on Home', () => {
  it('is not offered when nothing was in progress', async () => {
    const h = await reopen(new InMemoryStorage());
    expect(byId(h.r, 'home-resume')).toBeUndefined();
    expect(dump(h.r)).toContain('Level 1');
  });

  it('appears after the app was closed mid-level', async () => {
    const h = await reopen(await playSomeAndCloseApp());
    expect(byId(h.r, 'home-resume')).toBeDefined();
    expect(dump(h.r)).toContain('Resume - Level 1');
    expect(dump(h.r)).toContain('Level 1');
  });

  it('puts the player back exactly where they were', async () => {
    const h = await reopen(await playSomeAndCloseApp([1, 2, 4]));
    await press(h.r, 'home-resume');
    expect(dump(h.r)).toContain('Level 1');
    expect(dump(h.r)).toContain('Score 30');
    expect(dump(h.r)).toContain('Tray, 3 of 7 slots used');
    expect(dump(h.r)).not.toContain('"tile-1"');
    expect(h.analytics.events.map(e => e.name)).toContain('level_resume');
  });

  it('lets the resumed level be finished, then Resume goes away', async () => {
    const h = await reopen(await playSomeAndCloseApp([1, 2, 4]));
    await press(h.r, 'home-resume');
    await playTiles(h, [3, 5, 6]);
    expect(dump(h.r)).toContain('Level complete!');
    await press(h.r, 'result-home');
    expect(byId(h.r, 'home-resume')).toBeUndefined();
  });

  it('survives closing the app twice in a row', async () => {
    const storage = await playSomeAndCloseApp([1, 2]);
    const second = await reopen(storage);
    await press(second.r, 'home-resume');
    await press(second.r, 'tile-3');
    await act(async () => {
      second.r.unmount();
    });
    const third = await reopen(storage);
    await press(third.r, 'home-resume');
    expect(dump(third.r)).toContain('Score 130');
  });
});

describe('leaving on purpose', () => {
  it('Quit abandons the game, so there is nothing to resume', async () => {
    const h = await launch(source);
    await toHome(h);
    await press(h.r, 'home-continue');
    await press(h.r, 'tile-1');
    await press(h.r, 'game-quit');
    expect(byId(h.r, 'home-resume')).toBeUndefined();
  });

  it('Restart abandons the attempt, so a later close has nothing to resume', async () => {
    const storage = new InMemoryStorage();
    const first = await launch(source, storage);
    await toHome(first);
    await press(first.r, 'home-continue');
    await press(first.r, 'tile-1');
    await press(first.r, 'game-restart');
    await act(async () => {
      first.r.unmount();
    });
    const second = await reopen(storage);
    expect(byId(second.r, 'home-resume')).toBeUndefined();
  });

  it('losing a level clears the save', async () => {
    const h = await launch(fixedSource(losingLevel));
    await toHome(h);
    await press(h.r, 'home-continue');
    await loseTiles(h, [1, 4, 7, 10, 13, 16, 19]);
    expect(dump(h.r)).toContain('Tray full');
    await press(h.r, 'result-home');
    expect(byId(h.r, 'home-resume')).toBeUndefined();
  });
});

describe('a save that no longer fits', () => {
  it('starts the level fresh instead of failing', async () => {
    const storage = await playSomeAndCloseApp();
    const doc = JSON.parse(storage.getString('game.inProgress') as string);
    storage.setString(
      'game.inProgress',
      JSON.stringify({ ...doc, levelContentVersion: 'deadbeef' }),
    );
    const h = await reopen(storage);
    await press(h.r, 'home-resume');
    expect(dump(h.r)).toContain('Score 0');
    expect(dump(h.r)).toContain('Tray, 0 of 7 slots used');
  });
});
