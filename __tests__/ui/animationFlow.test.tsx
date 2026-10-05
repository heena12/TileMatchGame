import { ANIMATION } from '@ui/animation/timings';
import type { LevelData } from '@engine';
import { fixedSource, losingLevel, tinyLevel } from '../testUtils';
import {
  advance,
  dump,
  hostByPrefix,
  launch,
  playTiles,
  press,
  toHome,
} from '../harness';
import type { Harness } from '../harness';

jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

async function startGame(h: Harness) {
  await toHome(h);
  await press(h.r, 'home-continue');
}

const slotGlyphs = (h: Harness, index: number) =>
  hostByPrefix(h.r, `tray-slot-${index}`)[0]?.props.children;

/** Three types of three, so the level keeps going after two matches. */
const nineTiles = (levelId: number): LevelData => ({
  ...tinyLevel(levelId),
  tiles: Array.from({ length: 9 }, (_, i) => ({
    id: i + 1,
    typeId: Math.floor(i / 3) + 1,
    x: i % 8,
    y: Math.floor(i / 8) * 2,
    layer: 0,
  })),
});

describe('tile flight', () => {
  it('shows a flying tile after a tap and drops it once it has landed', async () => {
    const h = await launch();
    await startGame(h);
    expect(hostByPrefix(h.r, 'flight-')).toHaveLength(0);

    await press(h.r, 'tile-1');
    expect(hostByPrefix(h.r, 'flight-')).toHaveLength(1);
    expect(hostByPrefix(h.r, 'flight-1')).toHaveLength(1);

    await advance(ANIMATION.flightMs + ANIMATION.cleanupSlackMs + 5);
    expect(hostByPrefix(h.r, 'flight-')).toHaveLength(0);
  });

  it('keeps the tray slot empty while the tile is in the air, then fills it', async () => {
    const h = await launch();
    await startGame(h);
    await press(h.r, 'tile-1');
    expect(slotGlyphs(h, 0)).toBeNull();

    await advance(ANIMATION.flightMs + ANIMATION.cleanupSlackMs + 5);
    expect(slotGlyphs(h, 0)).not.toBeNull();
  });

  it('game state is updated at once, not after the animation', async () => {
    const h = await launch();
    await startGame(h);
    await press(h.r, 'tile-1');
    expect(dump(h.r)).toContain('Tray, 1 of 7 slots used');
    expect(dump(h.r)).toContain('Score 10');
  });

  it('several quick taps each get their own flight', async () => {
    const h = await launch();
    await startGame(h);
    await press(h.r, 'tile-1');
    await press(h.r, 'tile-2');
    expect(hostByPrefix(h.r, 'flight-')).toHaveLength(2);
    await advance(ANIMATION.flightMs + ANIMATION.cleanupSlackMs + 5);
    expect(hostByPrefix(h.r, 'flight-')).toHaveLength(0);
  });
});

describe('match burst', () => {
  it('pops the three matched tiles and clears them afterwards', async () => {
    const h = await launch();
    await startGame(h);
    await press(h.r, 'tile-1');
    await press(h.r, 'tile-2');
    expect(hostByPrefix(h.r, 'burst-ghost')).toHaveLength(0);

    await press(h.r, 'tile-3');
    expect(hostByPrefix(h.r, 'burst-ghost')).toHaveLength(3);
    // A first match is a plain match: paper shards, no crown.
    expect(hostByPrefix(h.r, 'match-star')).toHaveLength(0);

    await advance(
      ANIMATION.flightMs +
        Math.max(ANIMATION.burstMs, ANIMATION.celebrateMs) +
        ANIMATION.cleanupSlackMs +
        5,
    );
    expect(hostByPrefix(h.r, 'burst-ghost')).toHaveLength(0);
    expect(hostByPrefix(h.r, 'match-star')).toHaveLength(0);
  });
});

describe('rejected tap', () => {
  const layered = (id: number): LevelData => ({
    ...tinyLevel(id),
    tiles: [
      { id: 1, typeId: 1, x: 0, y: 0, layer: 0 },
      { id: 2, typeId: 1, x: 0.5, y: 0, layer: 1 },
      { id: 3, typeId: 1, x: 5, y: 0, layer: 0 },
    ],
  });

  it('flashes the covered tile, plays the reject cue and buzzes', async () => {
    const h = await launch(fixedSource(layered));
    await startGame(h);
    await press(h.r, 'tile-1');
    expect(hostByPrefix(h.r, 'reject-flash')).toHaveLength(1);
    expect(hostByPrefix(h.r, 'flight-')).toHaveLength(0);
    expect(h.audio.played).toEqual(['reject']);
    expect(h.haptics.triggered).toEqual(['error']);

    await advance(ANIMATION.flashMs + ANIMATION.cleanupSlackMs + 5);
    expect(hostByPrefix(h.r, 'reject-flash')).toHaveLength(0);
  });

  it('does not change the game or the score', async () => {
    const h = await launch(fixedSource(layered));
    await startGame(h);
    await press(h.r, 'tile-1');
    expect(dump(h.r)).toContain('Score 0');
    expect(dump(h.r)).toContain('Tray, 0 of 7 slots used');
  });
});

describe('sound and haptics during play', () => {
  it('plays a cue and a haptic for every accepted tap', async () => {
    const h = await launch();
    await startGame(h);
    await press(h.r, 'tile-1');
    await press(h.r, 'tile-2');
    await press(h.r, 'tile-3');
    expect(h.audio.played).toEqual(['select', 'select', 'select', 'match']);
    expect(h.haptics.triggered).toEqual(['light', 'light', 'light', 'medium']);
  });

  it('stays quiet after the player turns sound and haptics off', async () => {
    const h = await launch();
    h.container.model.stores.settings.getState().setSoundEnabled(false);
    h.container.model.stores.settings.getState().setHapticsEnabled(false);
    await startGame(h);
    await playTiles(h, [1, 2, 3]);
    expect(h.audio.played).toEqual([]);
    expect(h.haptics.triggered).toEqual([]);
  });

  it('plays the win fanfare when the level is cleared', async () => {
    const h = await launch();
    await startGame(h);
    await playTiles(h, [1, 2, 3, 4, 5, 6]);
    expect(h.audio.played.at(-1)).toBe('win');
    expect(h.haptics.triggered.at(-1)).toBe('success');
  });

  it('plays the lose cue when the tray fills', async () => {
    const h = await launch(fixedSource(losingLevel));
    await startGame(h);
    await playTiles(h, [1, 4, 7, 10, 13, 16, 19]);
    expect(h.audio.played.at(-1)).toBe('lose');
  });
});

describe('combo badge', () => {
  it('appears when matches chain and the level is still running', async () => {
    const h = await launch(fixedSource(nineTiles));
    await startGame(h);
    await playTiles(h, [1, 2, 3]);
    expect(dump(h.r)).not.toContain('Combo x');
    await playTiles(h, [4, 5, 6]);
    expect(dump(h.r)).toContain('Combo x1');
  });
});

describe('pause before Result', () => {
  it('stays on the Game screen until the last effect has played', async () => {
    const h = await launch();
    await startGame(h);
    for (const id of [1, 2, 3, 4, 5, 6]) {
      await press(h.r, `tile-${id}`);
    }
    expect(dump(h.r)).not.toContain('Level complete!');
    expect(dump(h.r)).toContain('Score 510');

    await advance(ANIMATION.endDelayMs - 50);
    expect(dump(h.r)).not.toContain('Level complete!');

    await advance(100);
    expect(dump(h.r)).toContain('Level complete!');
  });

  it('quitting during the pause cancels the move to Result', async () => {
    const h = await launch();
    await startGame(h);
    for (const id of [1, 2, 3, 4, 5, 6]) {
      await press(h.r, `tile-${id}`);
    }
    await press(h.r, 'game-quit');
    await advance(ANIMATION.endDelayMs + 200);
    expect(dump(h.r)).not.toContain('Level complete!');
    expect(dump(h.r)).toContain('Level');
  });
});
