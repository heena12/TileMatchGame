jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

import { transitionConfig } from '@ui/animation/transitionConfig';
import {
  advance,
  byId,
  dump,
  hostByPrefix,
  launch,
  press,
  toHome,
} from '../harness';

describe('screen exit fade', () => {
  beforeEach(() => {
    transitionConfig.exitMs = 140;
  });
  afterEach(() => {
    transitionConfig.exitMs = 0;
  });

  it('waits for the fade before the next screen opens', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-play');
    // Still on Home while it fades out.
    expect(hostByPrefix(h.r, 'map-region-')).toHaveLength(0);
    expect(byId(h.r, 'home-continue')).toBeDefined();
    await advance(200);
    expect(hostByPrefix(h.r, 'map-region-').length).toBeGreaterThan(0);
  });

  it('ignores a second tap while the screen is fading out', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-play');
    await press(h.r, 'home-continue');
    await advance(300);
    // Only the map opened; the second tap did not start a level.
    expect(hostByPrefix(h.r, 'map-region-').length).toBeGreaterThan(0);
    expect(dump(h.r)).not.toContain('Score 0');
  });

  it('shows the screen again when coming back to it', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-play');
    await advance(300);
    await press(h.r, 'level-map-back');
    await advance(300);
    expect(byId(h.r, 'home-continue')).toBeDefined();
  });
});

describe('settings card close animation', () => {
  beforeEach(() => {
    transitionConfig.modalMs = 200;
  });
  afterEach(() => {
    transitionConfig.modalMs = 0;
  });

  it('stays until it has faded out, and ignores a second tap meanwhile', async () => {
    const h = await launch();
    await toHome(h);
    await press(h.r, 'home-settings');
    await press(h.r, 'setting-close');
    expect(hostByPrefix(h.r, 'setting-sound')).toHaveLength(1);
    await press(h.r, 'setting-close');
    await advance(250);
    expect(hostByPrefix(h.r, 'setting-sound')).toHaveLength(0);
    expect(byId(h.r, 'home-continue')).toBeDefined();
  });
});
