import { RecordingAnalytics } from '@services/analytics/RecordingAnalytics';
import { RecordingAudio } from '@services/audio/RecordingAudio';
import { SystemClock } from '@services/clock/SystemClock';
import { RecordingHaptics } from '@services/haptics/RecordingHaptics';
import { createLevelSource } from '@services/levels/createLevelSource';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { FeedbackPlayer } from '@state/feedback';
import { GameController } from '@state/gameController';
import { createGameSessionStore } from '@state/gameSessionStore';
import { createProgressStore } from '@state/progressStore';
import { createSettingsStore } from '@state/settingsStore';
import { createSavedGameStore } from '@state/savedGameStore';
import { createTutorialStore, currentStep } from '@state/tutorialStore';
import { TUTORIAL_LEVELS } from '@services/levels/tutorialLevels';
import { autoplay, finishGuidance } from '../testUtils';

function setup() {
  const analytics = new RecordingAnalytics();
  const audio = new RecordingAudio();
  const haptics = new RecordingHaptics();
  const session = createGameSessionStore();
  const storage = new InMemoryStorage();
  const progress = createProgressStore(storage, new SystemClock());
  const settings = createSettingsStore(storage);
  const tutorial = createTutorialStore();
  const controller = new GameController({
    levelSource: createLevelSource(),
    analytics,
    session,
    progress,
    feedback: new FeedbackPlayer({ audio, haptics, settings }),
    tutorial,
    savedGame: createSavedGameStore(storage),
    random: { next: () => 0.5 },
  });
  return { controller, analytics, audio, session, progress, tutorial };
}

const step = (t: ReturnType<typeof createTutorialStore>) =>
  currentStep(t.getState());

describe('guidance on and off', () => {
  it('begins on a tutorial level while the tutorial is not completed', async () => {
    const { controller, tutorial } = setup();
    await controller.start(1);
    expect(tutorial.getState().levelId).toBe(1);
    expect(tutorial.getState().steps).toHaveLength(3);
    expect(step(tutorial)?.messageKey).toBe('tutorial.l1.tap');
  });

  it('does not begin once the tutorial is completed', async () => {
    const { controller, tutorial, progress } = setup();
    progress.getState().completeTutorial();
    await controller.start(1);
    expect(step(tutorial)).toBeNull();
  });

  it('begins again when a replay is forced, even after completion', async () => {
    const { controller, tutorial, progress } = setup();
    progress.getState().completeTutorial();
    await controller.start(1, { guided: true });
    expect(step(tutorial)?.messageKey).toBe('tutorial.l1.tap');
  });

  it('does not begin on a normal generated level', async () => {
    const { controller, tutorial } = setup();
    await controller.start(11);
    expect(step(tutorial)).toBeNull();
    expect(tutorial.getState().steps).toEqual([]);
  });

  it('does not begin on a normal level even when a replay is forced', async () => {
    const { controller, tutorial } = setup();
    await controller.start(11, { guided: true });
    expect(step(tutorial)).toBeNull();
  });

  it('ends the previous level guidance when another level starts', async () => {
    const { controller, tutorial } = setup();
    await controller.start(1);
    await controller.start(11);
    expect(step(tutorial)).toBeNull();
  });
});

describe('select steps', () => {
  it('ignores a tile that is not highlighted, nudges, and stays silent', async () => {
    const { controller, session, tutorial, audio, analytics } = setup();
    await controller.start(1);
    const before = session.getState().game;
    controller.select(18); // a free tile, but not the highlighted one
    expect(session.getState().game).toBe(before);
    expect(tutorial.getState().nudged).toBe(true);
    expect(step(tutorial)?.messageKey).toBe('tutorial.l1.tap');
    expect(audio.played).toEqual([]);
    expect(analytics.events.map(e => e.name)).toEqual(['level_start']);
  });

  it('accepts the highlighted tile, moves on and reports the step', async () => {
    const { controller, session, tutorial, analytics } = setup();
    await controller.start(1);
    controller.select(1);
    expect(session.getState().game?.tray.map(t => t.id)).toEqual([1]);
    expect(step(tutorial)?.messageKey).toBe('tutorial.l1.same');
    expect(tutorial.getState().nudged).toBe(false);
    expect(analytics.events).toContainEqual({
      name: 'tutorial_step',
      levelId: 1,
      step: 1,
    });
  });

  it('counts steps from 1 in order', async () => {
    const { controller, analytics, tutorial } = setup();
    await controller.start(1);
    finishGuidance(controller, tutorial);
    const steps = analytics.events
      .filter(e => e.name === 'tutorial_step')
      .map(e => (e as { step: number }).step);
    expect(steps).toEqual([1, 2, 3]);
  });

  it('lets the game carry on normally once the steps are done', async () => {
    const { controller, session, tutorial } = setup();
    await controller.start(1);
    finishGuidance(controller, tutorial);
    expect(step(tutorial)).toBeNull();
    const before = session.getState().game;
    controller.select(18);
    expect(session.getState().game).not.toBe(before);
  });
});

describe('tap steps', () => {
  async function toLevel3Start() {
    const ctx = setup();
    await ctx.controller.start(3);
    return ctx;
  }

  it('locks the board until "Got it"', async () => {
    const { controller, session, tutorial } = await toLevel3Start();
    expect(step(tutorial)?.waitFor).toBe('tap');
    const before = session.getState().game;
    controller.select(16); // any tile at all
    expect(session.getState().game).toBe(before);
    expect(tutorial.getState().nudged).toBe(true);
  });

  it('"Got it" moves to the next step and reports it', async () => {
    const { controller, tutorial, analytics } = await toLevel3Start();
    controller.tutorialContinue();
    expect(step(tutorial)?.waitFor).toBe('select');
    expect(analytics.events).toContainEqual({
      name: 'tutorial_step',
      levelId: 3,
      step: 1,
    });
  });

  it('"Got it" does nothing during a select step', async () => {
    const { controller, tutorial } = setup();
    await controller.start(1);
    controller.tutorialContinue();
    expect(step(tutorial)?.messageKey).toBe('tutorial.l1.tap');
  });

  it('"Got it" does nothing with no guidance or no level', async () => {
    const { controller, tutorial } = setup();
    expect(() => controller.tutorialContinue()).not.toThrow();
    await controller.start(11);
    controller.tutorialContinue();
    expect(step(tutorial)).toBeNull();
  });
});

describe('skip', () => {
  it('drops the guidance, completes the tutorial and reports it', async () => {
    const { controller, tutorial, progress, analytics } = setup();
    await controller.start(2);
    controller.select(1);
    controller.skipTutorial();
    expect(step(tutorial)).toBeNull();
    expect(progress.getState().tutorialCompleted).toBe(true);
    expect(analytics.events).toContainEqual({
      name: 'tutorial_skip',
      levelId: 2,
      atStep: 1,
    });
  });

  it('frees the board straight away', async () => {
    const { controller, session } = setup();
    await controller.start(1);
    controller.skipTutorial();
    const before = session.getState().game;
    controller.select(18);
    expect(session.getState().game).not.toBe(before);
  });

  it('does nothing when there is no guidance', async () => {
    const { controller, progress, analytics } = setup();
    await controller.start(11);
    controller.skipTutorial();
    expect(progress.getState().tutorialCompleted).toBe(false);
    expect(analytics.events.map(e => e.name)).not.toContain('tutorial_skip');
  });

  it('is not shown again on the next start', async () => {
    const { controller, tutorial } = setup();
    await controller.start(1);
    controller.skipTutorial();
    await controller.start(2);
    expect(step(tutorial)).toBeNull();
  });
});

describe('restart and quit', () => {
  it('restart starts the steps over', async () => {
    const { controller, tutorial } = setup();
    await controller.start(1);
    controller.select(1);
    await controller.restart();
    expect(step(tutorial)?.messageKey).toBe('tutorial.l1.tap');
  });

  it('restart keeps a replayed tutorial guided after completion', async () => {
    const { controller, tutorial, progress } = setup();
    progress.getState().completeTutorial();
    await controller.start(1, { guided: true });
    await controller.restart();
    expect(step(tutorial)?.messageKey).toBe('tutorial.l1.tap');
  });

  it('restart of a normal start stays unguided after completion', async () => {
    const { controller, tutorial, progress } = setup();
    progress.getState().completeTutorial();
    await controller.start(1);
    await controller.restart();
    expect(step(tutorial)).toBeNull();
  });

  it('quit ends the guidance', async () => {
    const { controller, tutorial } = setup();
    await controller.start(1);
    controller.quit();
    expect(step(tutorial)).toBeNull();
  });
});

describe('finishing tutorial levels', () => {
  it.each(Object.keys(TUTORIAL_LEVELS).map(Number))(
    'a naive player wins level %i by following the steps and then just matching',
    async id => {
      const { controller, session, tutorial } = setup();
      await controller.start(id);
      finishGuidance(controller, tutorial);
      autoplay(controller, session);
      expect(session.getState().status).toBe('won');
    },
  );

  it('clearing level 10 completes the tutorial, clearing earlier ones does not', async () => {
    const { controller, session, tutorial, progress } = setup();
    for (let id = 1; id <= 9; id++) {
      await controller.start(id);
      finishGuidance(controller, tutorial);
      autoplay(controller, session);
    }
    expect(progress.getState().tutorialCompleted).toBe(false);
    await controller.start(10);
    finishGuidance(controller, tutorial);
    autoplay(controller, session);
    expect(progress.getState().tutorialCompleted).toBe(true);
    expect(progress.getState().highestUnlockedLevel).toBe(11);
  });

  it('winning or losing ends any remaining guidance', async () => {
    const { controller, session, tutorial } = setup();
    await controller.start(8);
    controller.tutorialContinue(); // level 8 has a single message step
    expect(step(tutorial)).toBeNull();
    autoplay(controller, session);
    expect(step(tutorial)).toBeNull();
  });
});
