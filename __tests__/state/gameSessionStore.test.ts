import { initialScoreState } from '@engine';
import { createGameSessionStore } from '@state/gameSessionStore';

describe('gameSessionStore', () => {
  it('starts idle and empty', () => {
    expect(createGameSessionStore().getState()).toMatchObject({
      levelId: null,
      status: 'idle',
      game: null,
      freeTileIds: [],
      result: null,
      errorMessage: null,
      score: initialScoreState,
    });
  });

  it('patch merges only the given fields', () => {
    const store = createGameSessionStore();
    store.getState().patch({ levelId: 7, status: 'loading' });
    store.getState().patch({ status: 'playing' });
    expect(store.getState()).toMatchObject({ levelId: 7, status: 'playing' });
  });

  it('reset returns everything to the initial state', () => {
    const store = createGameSessionStore();
    store.getState().patch({
      levelId: 3,
      status: 'error',
      errorMessage: 'boom',
      freeTileIds: [1, 2],
    });
    store.getState().reset();
    expect(store.getState()).toMatchObject({
      levelId: null,
      status: 'idle',
      errorMessage: null,
      freeTileIds: [],
    });
  });

  it('notifies subscribers on change', () => {
    const store = createGameSessionStore();
    const seen: string[] = [];
    store.subscribe(s => seen.push(s.status));
    store.getState().patch({ status: 'loading' });
    store.getState().patch({ status: 'playing' });
    expect(seen).toEqual(['loading', 'playing']);
  });
});
