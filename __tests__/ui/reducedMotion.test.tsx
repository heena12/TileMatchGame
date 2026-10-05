import { ANIMATION } from '@ui/animation/timings';
import { advance, dump, hostByPrefix, launch, press, toHome } from '../harness';

jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

// The player has "reduce motion" switched on in system settings.
beforeAll(() => {
  (globalThis as { __REDUCED_MOTION__?: boolean }).__REDUCED_MOTION__ = true;
});
afterAll(() => {
  delete (globalThis as { __REDUCED_MOTION__?: boolean }).__REDUCED_MOTION__;
});

describe('reduced motion', () => {
  it('draws no flights, bursts or flashes', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-continue');
    await press(h.r, 'tile-1');
    await press(h.r, 'tile-2');
    await press(h.r, 'tile-3');
    expect(hostByPrefix(h.r, 'flight-')).toHaveLength(0);
    expect(hostByPrefix(h.r, 'burst-ghost')).toHaveLength(0);
    expect(dump(h.r)).toContain('Score 130');
  });

  it('keeps sound and haptics (they have their own settings)', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-continue');
    await press(h.r, 'tile-1');
    expect(h.audio.played).toEqual(['select']);
    expect(h.haptics.triggered).toEqual(['light']);
  });

  it('opens Result without the celebration pause', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-continue');
    for (const id of [1, 2, 3, 4, 5, 6]) {
      await press(h.r, `tile-${id}`);
    }
    await advance(10);
    expect(ANIMATION.endDelayMs).toBeGreaterThan(10);
    expect(dump(h.r)).toContain('Level complete!');
  });
});
