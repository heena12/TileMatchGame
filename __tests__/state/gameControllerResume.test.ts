import type { ILevelSource, LevelData } from '@engine';
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
import { createSavedGameStore } from '@state/savedGameStore';
import { createSettingsStore } from '@state/settingsStore';
import { createTutorialStore, currentStep } from '@state/tutorialStore';
import { fixedSource, losingLevel, tinyLevel } from '../testUtils';

/** One "run" of the app. Building a second one on the same storage simulates a restart. */
function boot(
  storage: InMemoryStorage,
  source: ILevelSource<LevelData> = fixedSource(tinyLevel),
) {
  const analytics = new RecordingAnalytics();
  const session = createGameSessionStore();
  const progress = createProgressStore(storage, new SystemClock());
  const savedGame = createSavedGameStore(storage);
  const tutorial = createTutorialStore();
  const settings = createSettingsStore(storage);
  const controller = new GameController({
    levelSource: source,
    analytics,
    session,
    progress,
    feedback: new FeedbackPlayer({
      audio: new RecordingAudio(),
      haptics: new RecordingHaptics(),
      settings,
    }),
    tutorial,
    savedGame,
    random: { next: () => 0.5 },
  });
  return { controller, analytics, session, progress, savedGame, tutorial };
}

const tap = (c: GameController, ids: number[]) =>
  ids.forEach(id => c.select(id));

describe('saving while playing', () => {
  it('saves after every accepted move', async () => {
    const { controller, savedGame } = boot(new InMemoryStorage());
    await controller.start(1);
    expect(savedGame.getState().summary).toBeNull();
    tap(controller, [1]);
    expect(savedGame.getState().summary).toEqual({ levelId: 1, moves: 1 });
    tap(controller, [2, 4]);
    expect(savedGame.getState().summary).toEqual({ levelId: 1, moves: 3 });
    expect(
      savedGame
        .getState()
        .read()
        ?.commands.map(c => (c.type === 'SELECT_TILE' ? c.tileId : -1)),
    ).toEqual([1, 2, 4]);
  });

  it('does not save a rejected tap', async () => {
    const layered = (id: number): LevelData => ({
      ...tinyLevel(id),
      tiles: [
        { id: 1, typeId: 1, x: 0, y: 0, layer: 0 },
        { id: 2, typeId: 1, x: 0.5, y: 0, layer: 1 },
        { id: 3, typeId: 1, x: 5, y: 0, layer: 0 },
      ],
    });
    const { controller, savedGame } = boot(
      new InMemoryStorage(),
      fixedSource(layered),
    );
    await controller.start(1);
    controller.select(1); // covered
    controller.select(99); // unknown
    expect(savedGame.getState().summary).toBeNull();
    controller.select(2);
    expect(savedGame.getState().summary?.moves).toBe(1);
  });

  it('records the level fingerprint with the save', async () => {
    const { controller, savedGame } = boot(new InMemoryStorage());
    await controller.start(1);
    tap(controller, [1]);
    expect(savedGame.getState().read()?.levelContentVersion).toMatch(
      /^[0-9a-f]{8}$/,
    );
  });
});

describe('clearing the save', () => {
  it('clears when the level is won', async () => {
    const { controller, savedGame } = boot(new InMemoryStorage());
    await controller.start(1);
    tap(controller, [1, 2, 3, 4, 5]);
    expect(savedGame.getState().summary).not.toBeNull();
    tap(controller, [6]);
    expect(savedGame.getState().summary).toBeNull();
    expect(savedGame.getState().read()).toBeNull();
  });

  it('clears when the level is lost', async () => {
    const { controller, savedGame } = boot(
      new InMemoryStorage(),
      fixedSource(losingLevel),
    );
    await controller.start(1);
    tap(controller, [1, 4, 7, 10, 13, 16]);
    expect(savedGame.getState().summary?.moves).toBe(6);
    tap(controller, [19]);
    expect(savedGame.getState().summary).toBeNull();
  });

  it('clears when the player quits a game in progress', async () => {
    const { controller, savedGame } = boot(new InMemoryStorage());
    await controller.start(1);
    tap(controller, [1, 2]);
    controller.quit();
    expect(savedGame.getState().summary).toBeNull();
  });

  it('keeps the save when quit is called while still loading', async () => {
    const storage = new InMemoryStorage();
    const first = boot(storage);
    await first.controller.start(1);
    tap(first.controller, [1, 2]);

    let release!: (l: LevelData) => void;
    const slow: ILevelSource<LevelData> = {
      getLevel: () => new Promise(res => (release = res)),
    };
    const second = boot(storage, slow);
    const loading = second.controller.start(2);
    second.controller.quit();
    release(tinyLevel(2));
    await loading;
    expect(second.savedGame.getState().summary).toEqual({
      levelId: 1,
      moves: 2,
    });
  });

  it('clears on Restart, since that abandons the attempt', async () => {
    const { controller, savedGame } = boot(new InMemoryStorage());
    await controller.start(1);
    tap(controller, [1, 2]);
    await controller.restart();
    expect(savedGame.getState().summary).toBeNull();
  });

  it('starting a level fresh does not erase a save for another level until a move is made', async () => {
    const storage = new InMemoryStorage();
    const first = boot(storage);
    await first.controller.start(1);
    tap(first.controller, [1, 2]);

    const second = boot(storage);
    await second.controller.start(3);
    expect(second.savedGame.getState().summary?.levelId).toBe(1);
    tap(second.controller, [1]);
    expect(second.savedGame.getState().summary).toEqual({
      levelId: 3,
      moves: 1,
    });
  });

  it('closing the app without quitting keeps the save', async () => {
    const storage = new InMemoryStorage();
    const first = boot(storage);
    await first.controller.start(1);
    tap(first.controller, [1, 2, 3]);
    // No quit: the process just ends. A new run sees the save.
    expect(boot(storage).savedGame.getState().summary).toEqual({
      levelId: 1,
      moves: 3,
    });
  });
});

describe('resuming', () => {
  async function playAndCloseApp(ids: number[]) {
    const storage = new InMemoryStorage();
    const first = boot(storage);
    await first.controller.start(1);
    tap(first.controller, ids);
    return { storage, first };
  }

  it('rebuilds the board, tray and score exactly', async () => {
    const { storage, first } = await playAndCloseApp([1, 2, 3, 4]);
    const before = first.session.getState();

    const second = boot(storage);
    await second.controller.start(1, { resume: true });
    const after = second.session.getState();

    expect(after.status).toBe('playing');
    expect(after.game).toEqual(before.game);
    expect(after.freeTileIds).toEqual(before.freeTileIds);
    expect(after.score).toEqual(before.score);
    expect(after.game?.board.map(t => t.id)).toEqual([5, 6]);
    expect(after.game?.tray.map(t => t.id)).toEqual([4]);
  });

  it('restores a running combo, so the next chained match still pays its bonus', async () => {
    const { storage, first } = await playAndCloseApp([1, 2, 3, 4, 5]);
    const second = boot(storage);
    await second.controller.start(1, { resume: true });
    expect(second.session.getState().score).toEqual(
      first.session.getState().score,
    );

    tap(second.controller, [6]);
    tap(first.controller, [6]);
    expect(second.session.getState().score).toEqual(
      first.session.getState().score,
    );
    expect(second.session.getState().score.comboBonusTotal).toBe(50);
  });

  it('reports a resume, not a fresh start', async () => {
    const { storage } = await playAndCloseApp([1, 2, 3]);
    const second = boot(storage);
    await second.controller.start(1, { resume: true });
    expect(second.analytics.events).toEqual([
      { name: 'level_resume', levelId: 1, moves: 3 },
    ]);
  });

  it('can be finished, which pays out and clears the save', async () => {
    const { storage } = await playAndCloseApp([1, 2, 3, 4]);
    const second = boot(storage);
    await second.controller.start(1, { resume: true });
    tap(second.controller, [5, 6]);
    expect(second.session.getState().status).toBe('won');
    expect(second.session.getState().result?.stars).toBe(3);
    expect(second.progress.getState().highestUnlockedLevel).toBe(2);
    expect(second.savedGame.getState().summary).toBeNull();
  });

  it('keeps saving further moves after a resume', async () => {
    const { storage } = await playAndCloseApp([1, 2]);
    const second = boot(storage);
    await second.controller.start(1, { resume: true });
    tap(second.controller, [3]);
    expect(second.savedGame.getState().summary).toEqual({
      levelId: 1,
      moves: 3,
    });
    const third = boot(storage);
    await third.controller.start(1, { resume: true });
    expect(third.session.getState().game?.board.map(t => t.id)).toEqual([
      4, 5, 6,
    ]);
  });

  it('does not begin tutorial guidance on a resumed game', async () => {
    const storage = new InMemoryStorage();
    const first = boot(storage, createLevelSource());
    await first.controller.start(1);
    expect(currentStep(first.tutorial.getState())).not.toBeNull();
    first.controller.select(1); // the highlighted tile

    const second = boot(storage, createLevelSource());
    await second.controller.start(1, { resume: true });
    expect(currentStep(second.tutorial.getState())).toBeNull();
    expect(second.session.getState().game?.tray.map(t => t.id)).toEqual([1]);
  });

  it('starts fresh when there is nothing saved', async () => {
    const second = boot(new InMemoryStorage());
    await second.controller.start(1, { resume: true });
    expect(second.session.getState().game?.board).toHaveLength(6);
    expect(second.analytics.events).toEqual([
      { name: 'level_start', levelId: 1 },
    ]);
  });

  it('a normal start ignores a save for the same level', async () => {
    const { storage } = await playAndCloseApp([1, 2, 3]);
    const second = boot(storage);
    await second.controller.start(1);
    expect(second.session.getState().game?.board).toHaveLength(6);
    expect(second.session.getState().score.score).toBe(0);
  });

  it('Restart after a resume goes back to a fresh board', async () => {
    const { storage } = await playAndCloseApp([1, 2, 3]);
    const second = boot(storage);
    await second.controller.start(1, { resume: true });
    await second.controller.restart();
    expect(second.session.getState().game?.board).toHaveLength(6);
    expect(second.savedGame.getState().summary).toBeNull();
  });
});

describe('a save that cannot be used is dropped and the level starts fresh', () => {
  async function saveThenBoot(
    mutate: (storage: InMemoryStorage) => void,
    source?: ILevelSource<LevelData>,
  ) {
    const storage = new InMemoryStorage();
    const first = boot(storage);
    await first.controller.start(1);
    tap(first.controller, [1, 2]);
    mutate(storage);
    const second = boot(storage, source);
    await second.controller.start(1, { resume: true });
    return second;
  }

  const expectFresh = (run: Awaited<ReturnType<typeof saveThenBoot>>) => {
    expect(run.session.getState().status).toBe('playing');
    expect(run.session.getState().game?.board).toHaveLength(6);
    expect(run.session.getState().game?.tray).toHaveLength(0);
    expect(run.session.getState().score.score).toBe(0);
    expect(run.savedGame.getState().summary).toBeNull();
    expect(run.analytics.events).toEqual([{ name: 'level_start', levelId: 1 }]);
  };

  const rewrite = (
    storage: InMemoryStorage,
    change: Record<string, unknown>,
  ) => {
    const doc = JSON.parse(storage.getString('game.inProgress') as string);
    storage.setString('game.inProgress', JSON.stringify({ ...doc, ...change }));
  };

  it('when it belongs to a different level', async () => {
    expectFresh(await saveThenBoot(s => rewrite(s, { levelId: 4 })));
  });

  it('when the level content has changed since it was saved', async () => {
    const changed = (id: number): LevelData => {
      const level = tinyLevel(id);
      return {
        ...level,
        tiles: level.tiles.map((t, i) => (i === 0 ? { ...t, y: 3 } : t)),
      };
    };
    expectFresh(await saveThenBoot(() => undefined, fixedSource(changed)));
  });

  it("when the stored fingerprint is not the level's", async () => {
    expectFresh(
      await saveThenBoot(s => rewrite(s, { levelContentVersion: 'deadbeef' })),
    );
  });

  it('when a saved command no longer works', async () => {
    expectFresh(
      await saveThenBoot(s =>
        rewrite(s, {
          commands: [
            { type: 'SELECT_TILE', tileId: 1 },
            { type: 'SELECT_TILE', tileId: 999 },
          ],
        }),
      ),
    );
  });

  it('when a saved command repeats a tile already taken', async () => {
    expectFresh(
      await saveThenBoot(s =>
        rewrite(s, {
          commands: [
            { type: 'SELECT_TILE', tileId: 1 },
            { type: 'SELECT_TILE', tileId: 1 },
          ],
        }),
      ),
    );
  });

  it('when the saved game had in fact already finished', async () => {
    expectFresh(
      await saveThenBoot(s =>
        rewrite(s, {
          commands: [1, 2, 3, 4, 5, 6].map(tileId => ({
            type: 'SELECT_TILE',
            tileId,
          })),
        }),
      ),
    );
  });

  it('when the document is unreadable', async () => {
    const run = await saveThenBoot(s =>
      s.setString('game.inProgress', '{oops'),
    );
    expect(run.session.getState().status).toBe('playing');
    expect(run.session.getState().game?.board).toHaveLength(6);
    expect(run.analytics.events).toEqual([{ name: 'level_start', levelId: 1 }]);
  });
});
