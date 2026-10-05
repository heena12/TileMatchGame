import { generateLevel, solve } from '@engine';
import type { ILevelSource, LevelData } from '@engine';
import { RecordingAnalytics } from '@services/analytics/RecordingAnalytics';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { RecordingAudio } from '@services/audio/RecordingAudio';
import { SystemClock } from '@services/clock/SystemClock';
import { RecordingHaptics } from '@services/haptics/RecordingHaptics';
import { FeedbackPlayer } from '@state/feedback';
import { GameController } from '@state/gameController';
import { createGameSessionStore } from '@state/gameSessionStore';
import { createProgressStore } from '@state/progressStore';
import { createSettingsStore } from '@state/settingsStore';
import { createSavedGameStore } from '@state/savedGameStore';
import { createTutorialStore } from '@state/tutorialStore';
import { fixedSource, losingLevel, tinyLevel } from '../testUtils';

function setup(source: ILevelSource<LevelData> = fixedSource(tinyLevel)) {
  const analytics = new RecordingAnalytics();
  const session = createGameSessionStore();
  const storage = new InMemoryStorage();
  const progress = createProgressStore(storage, new SystemClock());
  const audio = new RecordingAudio();
  const haptics = new RecordingHaptics();
  const settings = createSettingsStore(storage);
  const controller = new GameController({
    levelSource: source,
    analytics,
    session,
    progress,
    feedback: new FeedbackPlayer({ audio, haptics, settings }),
    tutorial: createTutorialStore(),
    savedGame: createSavedGameStore(storage),
    random: { next: () => 0.5 },
  });
  return {
    controller,
    analytics,
    session,
    progress,
    storage,
    audio,
    haptics,
    settings,
  };
}

const tapAll = (c: GameController, ids: number[]) =>
  ids.forEach(id => c.select(id));

describe('GameController.start', () => {
  it('loads a level and exposes the snapshot', async () => {
    const { controller, session, analytics } = setup();
    const pending = controller.start(3);
    expect(session.getState()).toMatchObject({ levelId: 3, status: 'loading' });
    await pending;
    const s = session.getState();
    expect(s.status).toBe('playing');
    expect(s.game?.board).toHaveLength(6);
    expect(s.freeTileIds).toHaveLength(6);
    expect(analytics.events).toEqual([{ name: 'level_start', levelId: 3 }]);
  });

  it('reports a load failure without crashing', async () => {
    const failing: ILevelSource<LevelData> = {
      getLevel: async () => {
        throw new Error('disk on fire');
      },
    };
    const { controller, session, analytics } = setup(failing);
    await controller.start(1);
    expect(session.getState()).toMatchObject({
      status: 'error',
      errorMessage: 'disk on fire',
    });
    expect(analytics.events).toEqual([]);
  });

  it('describes non-Error failures generically', async () => {
    const weird: ILevelSource<LevelData> = {
      getLevel: () => Promise.reject('nope'),
    };
    const { controller, session } = setup(weird);
    await controller.start(1);
    expect(session.getState().errorMessage).toBe('Unknown error');
  });

  it('ignores a slow load that was superseded by a newer start', async () => {
    const resolvers: Record<number, (l: LevelData) => void> = {};
    const slow: ILevelSource<LevelData> = {
      getLevel: id => new Promise(res => (resolvers[id] = res)),
    };
    const { controller, session } = setup(slow);
    const first = controller.start(1);
    const second = controller.start(2);
    resolvers[2]?.(tinyLevel(2));
    await second;
    resolvers[1]?.(tinyLevel(1));
    await first;
    expect(session.getState().levelId).toBe(2);
    expect(session.getState().status).toBe('playing');
  });

  it('ignores a failure from a superseded load', async () => {
    const rejecters: Record<number, (e: Error) => void> = {};
    const source: ILevelSource<LevelData> = {
      getLevel: id =>
        id === 2
          ? Promise.resolve(tinyLevel(2))
          : new Promise((_, rej) => (rejecters[id] = rej)),
    };
    const { controller, session } = setup(source);
    const first = controller.start(1);
    await controller.start(2);
    rejecters[1]?.(new Error('late'));
    await first;
    expect(session.getState().status).toBe('playing');
  });
});

describe('GameController.select', () => {
  it('does nothing before a level is loaded', () => {
    const { controller, session } = setup();
    controller.select(1);
    expect(session.getState().status).toBe('idle');
  });

  it('moves a tile to the tray and scores it', async () => {
    const { controller, session } = setup();
    await controller.start(1);
    controller.select(1);
    const s = session.getState();
    expect(s.game?.tray.map(t => t.id)).toEqual([1]);
    expect(s.game?.board).toHaveLength(5);
    expect(s.score.score).toBe(10);
  });

  it('ignores rejected taps completely', async () => {
    const { controller, session } = setup();
    await controller.start(1);
    controller.select(1);
    const before = session.getState().game;
    controller.select(1); // already in the tray
    controller.select(999); // unknown
    expect(session.getState().game).toBe(before);
  });

  it('wins, awards stars and coins, saves progress and tells analytics', async () => {
    const { controller, session, progress, analytics } = setup();
    await controller.start(1);
    tapAll(controller, [1, 2, 3, 4, 5, 6]);
    const s = session.getState();
    // 60 selections + 200 matches + 50 combo + 200 clear bonus (peak tray 3) = 510.
    expect(s.status).toBe('won');
    expect(s.score.score).toBe(510);
    expect(s.result).toEqual({ stars: 3, coins: 25, improved: true });
    expect(progress.getState()).toMatchObject({
      highestUnlockedLevel: 2,
      coins: 25,
      levels: { 1: { stars: 3, bestScore: 510 } },
    });
    expect(analytics.events).toContainEqual({
      name: 'level_complete',
      levelId: 1,
      stars: 3,
      score: 510,
      moves: 6,
    });
  });

  it('pays no coins when a replay does not improve stars', async () => {
    const { controller, session, progress } = setup();
    for (let run = 0; run < 2; run++) {
      await controller.start(1);
      tapAll(controller, [1, 2, 3, 4, 5, 6]);
    }
    expect(session.getState().result).toEqual({
      stars: 3,
      coins: 0,
      improved: false,
    });
    expect(progress.getState().coins).toBe(25);
  });

  it('honours the level noBoosters flag when awarding stars', async () => {
    const { controller, session } = setup(
      fixedSource(id => ({ ...tinyLevel(id), noBoosters: true })),
    );
    await controller.start(1);
    tapAll(controller, [1, 2, 3, 4, 5, 6]);
    expect(session.getState().result?.stars).toBe(3);
  });

  it('loses when the tray fills, records analytics and saves nothing', async () => {
    const { controller, session, progress, analytics } = setup(
      fixedSource(losingLevel),
    );
    await controller.start(9);
    tapAll(controller, [1, 4, 7, 10, 13, 16, 19]);
    const s = session.getState();
    expect(s.status).toBe('lost');
    expect(s.result).toBeNull();
    expect(progress.getState().highestUnlockedLevel).toBe(1);
    expect(progress.getState().coins).toBe(0);
    expect(analytics.events).toContainEqual({
      name: 'level_fail',
      levelId: 9,
      peakTray: 7,
      remainingTiles: 8 * 3 - 0,
    });
  });

  it('plays a generated level to a win by following the solver', async () => {
    const level = generateLevel(30);
    const { controller, session } = setup(fixedSource(() => level));
    await controller.start(30);
    const solution = solve(level.tiles, 7 - level.validatedSlack, 200000);
    solution.solution?.forEach(id => controller.select(id));
    expect(session.getState().status).toBe('won');
    expect(session.getState().result?.stars).toBeGreaterThanOrEqual(1);
  });
});

describe('GameController.restart / quit', () => {
  it('restart begins the same level again from scratch', async () => {
    const { controller, session, analytics } = setup();
    await controller.start(5);
    controller.select(1);
    await controller.restart();
    expect(session.getState().game?.board).toHaveLength(6);
    expect(session.getState().score.score).toBe(0);
    expect(analytics.events.filter(e => e.name === 'level_start')).toHaveLength(
      2,
    );
  });

  it('restart with no level does nothing', async () => {
    const { controller, session } = setup();
    await controller.restart();
    expect(session.getState().status).toBe('idle');
  });

  it('quit resets the session and ignores taps and late loads', async () => {
    let resolve!: (l: LevelData) => void;
    const slow: ILevelSource<LevelData> = {
      getLevel: () => new Promise(res => (resolve = res)),
    };
    const { controller, session } = setup(slow);
    const loading = controller.start(1);
    controller.quit();
    resolve(tinyLevel(1));
    await loading;
    expect(session.getState().status).toBe('idle');
    controller.select(1);
    expect(session.getState().game).toBeNull();
  });
});

describe('GameController step records and feedback', () => {
  it('records each accepted tap as a step with the tile and the tray before it', async () => {
    const { controller, session } = setup();
    await controller.start(1);
    controller.select(1);
    controller.select(2);
    const step = session.getState().lastStep;
    expect(step?.tile?.id).toBe(2);
    expect(step?.trayBefore.map(t => t.id)).toEqual([1]);
    expect(step?.events.map(e => e.type)).toEqual(['TILE_SELECTED']);
  });

  it('gives every step a rising seq, even across restarts', async () => {
    const { controller, session } = setup();
    await controller.start(1);
    controller.select(1);
    const first = session.getState().lastStep?.seq as number;
    await controller.restart();
    expect(session.getState().lastStep).toBeNull();
    controller.select(1);
    expect(session.getState().lastStep?.seq).toBeGreaterThan(first);
  });

  it('turns a rejected tap into a step without touching the game', async () => {
    const { controller, session, audio } = setup(
      fixedSource(id => ({
        ...tinyLevel(id),
        tiles: [
          { id: 1, typeId: 1, x: 0, y: 0, layer: 0 },
          { id: 2, typeId: 1, x: 0.5, y: 0, layer: 1 },
          { id: 3, typeId: 1, x: 5, y: 0, layer: 0 },
        ],
      })),
    );
    await controller.start(1);
    const gameBefore = session.getState().game;
    controller.select(1); // covered by tile 2
    const step = session.getState().lastStep;
    expect(step?.events).toEqual([
      { type: 'COMMAND_REJECTED', reason: 'TILE_BLOCKED' },
    ]);
    expect(step?.tile?.id).toBe(1);
    expect(session.getState().game).toBe(gameBefore);
    expect(audio.played).toEqual(['reject']);
  });

  it('plays select, match, combo and win cues in order over a whole level', async () => {
    const { controller, audio } = setup();
    await controller.start(1);
    tapAll(controller, [1, 2, 3, 4, 5, 6]);
    expect(audio.played).toEqual([
      'select',
      'select',
      'select',
      'match',
      'select',
      'select',
      'select',
      'combo',
      'win',
    ]);
  });

  it('plays the lose cue and matching haptics when the tray fills', async () => {
    const { controller, audio, haptics } = setup(fixedSource(losingLevel));
    await controller.start(1);
    tapAll(controller, [1, 4, 7, 10, 13, 16, 19]);
    expect(audio.played.at(-1)).toBe('lose');
    expect(haptics.triggered.at(-1)).toBe('error');
    expect(haptics.triggered.slice(0, 6)).toEqual(Array(6).fill('light'));
  });

  it('stays silent when sound and haptics are turned off', async () => {
    const { controller, audio, haptics, settings } = setup();
    settings.getState().setSoundEnabled(false);
    settings.getState().setHapticsEnabled(false);
    await controller.start(1);
    tapAll(controller, [1, 2, 3]);
    expect(audio.played).toEqual([]);
    expect(haptics.triggered).toEqual([]);
  });
});
