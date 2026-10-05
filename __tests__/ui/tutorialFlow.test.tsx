import { createLevelSource } from '@services/levels/createLevelSource';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { ANIMATION } from '@ui/animation/timings';
import {
  act,
  advance,
  byId,
  dump,
  hostByPrefix,
  launch,
  press,
  toHome,
} from '../harness';
import type { Harness } from '../harness';
import { autoplay, flush } from '../testUtils';

jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick'] });

const launchTutorial = (storage = new InMemoryStorage()) =>
  launch(createLevelSource(), storage);

async function openLevelOne(h: Harness) {
  await toHome(h);
  await press(h.r, 'home-continue');
}

const isCoachShown = (h: Harness) =>
  hostByPrefix(h.r, 'tutorial-coach').length > 0;

describe('level 1 coach', () => {
  it('shows the first message, a ring on the tile to tap, and a way to skip', async () => {
    const h = await launchTutorial();
    await openLevelOne(h);
    expect(isCoachShown(h)).toBe(true);
    expect(dump(h.r)).toContain(
      'Welcome! Tap a tile to send it to the tray below.',
    );
    expect(hostByPrefix(h.r, 'tutorial-ring-')).toHaveLength(1);
    expect(hostByPrefix(h.r, 'tutorial-ring-1')).toHaveLength(1);
    expect(byId(h.r, 'tutorial-skip')).toBeDefined();
    expect(byId(h.r, 'tutorial-continue')).toBeUndefined();
  });

  it('ignores a tile that is not highlighted and explains why', async () => {
    const h = await launchTutorial();
    await openLevelOne(h);
    expect(hostByPrefix(h.r, 'tutorial-nudge')).toHaveLength(0);
    await press(h.r, 'tile-18');
    expect(dump(h.r)).toContain('Tray, 0 of 7 slots used');
    expect(dump(h.r)).toContain('Tap the highlighted tile to continue.');
  });

  it('walks through the three steps and then hides the coach', async () => {
    const h = await launchTutorial();
    await openLevelOne(h);

    await press(h.r, 'tile-1');
    expect(dump(h.r)).toContain('Now tap another tile with the same picture.');
    expect(hostByPrefix(h.r, 'tutorial-ring-2')).toHaveLength(1);
    expect(dump(h.r)).not.toContain('Tap the highlighted tile to continue.');

    await press(h.r, 'tile-2');
    expect(dump(h.r)).toContain('Three of a kind vanish!');

    await press(h.r, 'tile-3');
    expect(isCoachShown(h)).toBe(false);
    expect(hostByPrefix(h.r, 'tutorial-ring-')).toHaveLength(0);
    expect(dump(h.r)).toContain('Score 130');
  });

  it('frees the board once the steps are done', async () => {
    const h = await launchTutorial();
    await openLevelOne(h);
    for (const id of [1, 2, 3]) {
      await press(h.r, `tile-${id}`);
    }
    await press(h.r, 'tile-18');
    expect(dump(h.r)).toContain('Tray, 1 of 7 slots used');
  });

  it('Skip removes the coach, unlocks the board and remembers it', async () => {
    const h = await launchTutorial();
    await openLevelOne(h);
    await press(h.r, 'tutorial-skip');
    expect(isCoachShown(h)).toBe(false);
    expect(h.container.model.stores.progress.getState().tutorialCompleted).toBe(
      true,
    );
    await press(h.r, 'tile-18');
    expect(dump(h.r)).toContain('Tray, 1 of 7 slots used');
  });

  it('reports the steps to analytics', async () => {
    const h = await launchTutorial();
    await openLevelOne(h);
    await press(h.r, 'tile-1');
    expect(h.analytics.events).toContainEqual({
      name: 'tutorial_step',
      levelId: 1,
      step: 1,
    });
  });
});

describe('message-only steps', () => {
  async function openLevelThree(h: Harness) {
    h.container.model.stores.progress.getState().recordResult({
      levelId: 2,
      stars: 1,
      score: 1,
      coins: 0,
    });
    await toHome(h);
    await press(h.r, 'home-continue');
  }

  it('shows "Got it" and locks the board until it is pressed', async () => {
    const h = await launchTutorial();
    await openLevelThree(h);
    expect(dump(h.r)).toContain('Level 3');
    expect(dump(h.r)).toContain(
      "Covered tiles are dimmed and can't be tapped.",
    );
    expect(byId(h.r, 'tutorial-continue')).toBeDefined();

    await press(h.r, 'tile-16'); // a tile on the top layer
    expect(dump(h.r)).toContain('Tray, 0 of 7 slots used');

    await press(h.r, 'tutorial-continue');
    expect(dump(h.r)).toContain('Tap a tile on top.');
    expect(byId(h.r, 'tutorial-continue')).toBeUndefined();
  });

  it('marks covered tiles in the covered-tile lesson', async () => {
    const h = await launchTutorial();
    await openLevelThree(h);
    expect(dump(h.r)).toContain('covered');
  });
});

describe('replay from Settings', () => {
  async function finishedTutorialApp() {
    const storage = new InMemoryStorage();
    const h = await launchTutorial(storage);
    h.container.model.stores.progress.getState().completeTutorial();
    return h;
  }

  it('is not offered as guidance on a normal run after completion', async () => {
    const h = await finishedTutorialApp();
    await openLevelOne(h);
    expect(isCoachShown(h)).toBe(false);
  });

  it('Replay tutorial opens level 1 guided again', async () => {
    const h = await finishedTutorialApp();
    await toHome(h);
    await press(h.r, 'home-settings');
    await press(h.r, 'setting-replay-tutorial');
    expect(dump(h.r)).toContain('Level 1');
    expect(isCoachShown(h)).toBe(true);
    expect(dump(h.r)).toContain('Welcome!');
  });

  it('keeps Next level and Try again guided during a replay', async () => {
    const h = await finishedTutorialApp();
    await toHome(h);
    await press(h.r, 'home-settings');
    await press(h.r, 'setting-replay-tutorial');

    // Follow level 1's steps, then play it out.
    for (const id of [1, 2, 3]) {
      await press(h.r, `tile-${id}`);
    }
    await act(async () => {
      autoplay(
        h.container.model.controller,
        h.container.model.stores.gameSession,
      );
      await flush();
    });
    await advance(ANIMATION.endDelayMs + 100);
    expect(dump(h.r)).toContain('Level complete!');

    await press(h.r, 'result-next');
    expect(dump(h.r)).toContain('Level 2');
    expect(isCoachShown(h)).toBe(true);
  });

  it('a normal Next level after a normal win is not guided once completed', async () => {
    const h = await finishedTutorialApp();
    await openLevelOne(h);
    await act(async () => {
      autoplay(
        h.container.model.controller,
        h.container.model.stores.gameSession,
      );
      await flush();
    });
    await advance(ANIMATION.endDelayMs + 100);
    await press(h.r, 'result-next');
    expect(dump(h.r)).toContain('Level 2');
    expect(isCoachShown(h)).toBe(false);
  });
});

describe('through the whole tutorial', () => {
  it('wins level 1 as a new player: steps, then free play, then Result', async () => {
    const h = await launchTutorial();
    await openLevelOne(h);
    for (const id of [1, 2, 3]) {
      await press(h.r, `tile-${id}`);
    }
    await act(async () => {
      autoplay(
        h.container.model.controller,
        h.container.model.stores.gameSession,
      );
      await flush();
    });
    await advance(ANIMATION.endDelayMs + 100);
    expect(dump(h.r)).toContain('Level complete!');
    expect(
      h.container.model.stores.progress.getState().highestUnlockedLevel,
    ).toBe(2);
    expect(h.container.model.stores.progress.getState().tutorialCompleted).toBe(
      false,
    );
  });
});
