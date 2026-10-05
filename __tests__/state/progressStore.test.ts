import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { createProgressStore } from '@state/progressStore';

const clock = (start = 1000) => {
  let now = start;
  return { now: () => now++ };
};

describe('progressStore', () => {
  it('starts with level 1 unlocked and nothing cleared', () => {
    const s = createProgressStore(new InMemoryStorage(), clock()).getState();
    expect(s).toMatchObject({
      highestUnlockedLevel: 1,
      levels: {},
      coins: 0,
      updatedAt: 0,
    });
  });

  it('records a result: stars, best score, coins, unlock and timestamp', () => {
    const store = createProgressStore(new InMemoryStorage(), clock(5000));
    store
      .getState()
      .recordResult({ levelId: 1, stars: 2, score: 400, coins: 20 });
    expect(store.getState()).toMatchObject({
      highestUnlockedLevel: 2,
      levels: { 1: { stars: 2, bestScore: 400 } },
      coins: 20,
      updatedAt: 5000,
    });
  });

  it('keeps the best stars and best score across replays and adds coins', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    store
      .getState()
      .recordResult({ levelId: 4, stars: 3, score: 900, coins: 25 });
    store
      .getState()
      .recordResult({ levelId: 4, stars: 1, score: 500, coins: 0 });
    expect(store.getState().levels[4]).toEqual({ stars: 3, bestScore: 900 });
    store
      .getState()
      .recordResult({ levelId: 4, stars: 3, score: 1200, coins: 0 });
    expect(store.getState().levels[4]).toEqual({ stars: 3, bestScore: 1200 });
    expect(store.getState().coins).toBe(25);
  });

  it('never lowers the highest unlocked level', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    store
      .getState()
      .recordResult({ levelId: 10, stars: 1, score: 1, coins: 0 });
    store.getState().recordResult({ levelId: 2, stars: 1, score: 1, coins: 0 });
    expect(store.getState().highestUnlockedLevel).toBe(11);
  });

  it('persists and restores progress in a new store', () => {
    const storage = new InMemoryStorage();
    createProgressStore(storage, clock())
      .getState()
      .recordResult({ levelId: 7, stars: 3, score: 800, coins: 25 });
    const restored = createProgressStore(storage, clock()).getState();
    expect(restored).toMatchObject({
      highestUnlockedLevel: 8,
      coins: 25,
      levels: { 7: { stars: 3, bestScore: 800 } },
    });
  });

  it('saves a versioned document', () => {
    const storage = new InMemoryStorage();
    createProgressStore(storage, clock())
      .getState()
      .recordResult({ levelId: 1, stars: 1, score: 10, coins: 15 });
    const saved = JSON.parse(storage.getString('player.progress') as string);
    expect(saved.schemaVersion).toBe(3);
    expect(saved.wallet).toEqual({ coins: 15 });
    expect(saved.inventory).toEqual({});
  });

  it.each([
    ['not json', '{oops'],
    ['wrong schema version', JSON.stringify({ schemaVersion: 99, coins: 5 })],
  ])('falls back to defaults on %s', (_name, raw) => {
    const storage = new InMemoryStorage();
    storage.setString('player.progress', raw);
    expect(createProgressStore(storage, clock()).getState()).toMatchObject({
      highestUnlockedLevel: 1,
      coins: 0,
      levels: {},
    });
  });

  it('drops invalid entries but keeps valid ones', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.progress',
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: 9,
        highestUnlockedLevel: 3.5,
        coins: -4,
        levels: {
          2: { stars: 2, bestScore: 300 },
          abc: { stars: 1, bestScore: 1 },
          0: { stars: 1, bestScore: 1 },
          5: { stars: 'x', bestScore: 1 },
        },
      }),
    );
    const s = createProgressStore(storage, clock()).getState();
    expect(s.levels).toEqual({ 2: { stars: 2, bestScore: 300 } });
    expect(s.highestUnlockedLevel).toBe(1);
    expect(s.coins).toBe(0);
    expect(s.updatedAt).toBe(9);
  });

  it('tolerates a document without a levels map', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.progress',
      JSON.stringify({ schemaVersion: 1, highestUnlockedLevel: 6, coins: 3 }),
    );
    expect(createProgressStore(storage, clock()).getState()).toMatchObject({
      highestUnlockedLevel: 6,
      coins: 3,
      levels: {},
    });
  });
});

describe('progressStore tutorial flag', () => {
  it('starts not completed', () => {
    expect(
      createProgressStore(new InMemoryStorage(), clock()).getState()
        .tutorialCompleted,
    ).toBe(false);
  });

  it('is not completed by clearing an early level', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    store.getState().recordResult({ levelId: 9, stars: 3, score: 1, coins: 0 });
    expect(store.getState().tutorialCompleted).toBe(false);
  });

  it('is completed by clearing the last tutorial level', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    store
      .getState()
      .recordResult({ levelId: 10, stars: 1, score: 1, coins: 0 });
    expect(store.getState().tutorialCompleted).toBe(true);
  });

  it('completeTutorial sets it, saves it and stamps the time', () => {
    const storage = new InMemoryStorage();
    const store = createProgressStore(storage, clock(7000));
    store.getState().completeTutorial();
    expect(store.getState()).toMatchObject({
      tutorialCompleted: true,
      updatedAt: 7000,
    });
    expect(
      JSON.parse(storage.getString('player.progress') as string)
        .tutorialCompleted,
    ).toBe(true);
  });

  it('completeTutorial twice does not save again', () => {
    const storage = new InMemoryStorage();
    const store = createProgressStore(storage, clock(1));
    store.getState().completeTutorial();
    const first = storage.getString('player.progress');
    store.getState().completeTutorial();
    expect(storage.getString('player.progress')).toBe(first);
  });

  it('keeps the flag across an app restart', () => {
    const storage = new InMemoryStorage();
    createProgressStore(storage, clock()).getState().completeTutorial();
    expect(
      createProgressStore(storage, clock()).getState().tutorialCompleted,
    ).toBe(true);
  });

  it('never clears the flag when later results are recorded', () => {
    const store = createProgressStore(new InMemoryStorage(), clock());
    store.getState().completeTutorial();
    store.getState().recordResult({ levelId: 2, stars: 1, score: 1, coins: 0 });
    expect(store.getState().tutorialCompleted).toBe(true);
  });

  it('treats an older save without the flag as completed once past level 10', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.progress',
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: 1,
        highestUnlockedLevel: 40,
        coins: 5,
        levels: {},
      }),
    );
    expect(
      createProgressStore(storage, clock()).getState().tutorialCompleted,
    ).toBe(true);
  });

  it('treats an older save still inside the tutorial as not completed', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.progress',
      JSON.stringify({
        schemaVersion: 1,
        updatedAt: 1,
        highestUnlockedLevel: 4,
        coins: 5,
        levels: {},
      }),
    );
    expect(
      createProgressStore(storage, clock()).getState().tutorialCompleted,
    ).toBe(false);
  });
});
