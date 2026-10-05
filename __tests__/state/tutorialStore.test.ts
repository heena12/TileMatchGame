import type { TutorialStep } from '@engine';
import {
  createTutorialStore,
  currentStep,
  stepAllowsTile,
} from '@state/tutorialStore';

const select: TutorialStep = {
  messageKey: 'k.select',
  waitFor: 'select',
  highlightTileIds: [4, 5],
};
const tap: TutorialStep = {
  messageKey: 'k.tap',
  waitFor: 'tap',
  highlightTileIds: [4],
};

describe('stepAllowsTile', () => {
  it('lets a select step accept only its highlighted tiles', () => {
    expect(stepAllowsTile(select, 4)).toBe(true);
    expect(stepAllowsTile(select, 5)).toBe(true);
    expect(stepAllowsTile(select, 6)).toBe(false);
  });

  it('locks the board during a tap step, even for highlighted tiles', () => {
    expect(stepAllowsTile(tap, 4)).toBe(false);
  });
});

describe('tutorialStore', () => {
  it('starts idle with nothing to show', () => {
    const state = createTutorialStore().getState();
    expect(state.steps).toEqual([]);
    expect(currentStep(state)).toBeNull();
  });

  it('begin shows the first step', () => {
    const store = createTutorialStore();
    store.getState().begin(2, [select, tap]);
    expect(store.getState().levelId).toBe(2);
    expect(currentStep(store.getState())).toBe(select);
  });

  it('advance moves through the steps and then runs out', () => {
    const store = createTutorialStore();
    store.getState().begin(1, [select, tap]);
    store.getState().advance();
    expect(currentStep(store.getState())).toBe(tap);
    store.getState().advance();
    expect(currentStep(store.getState())).toBeNull();
  });

  it('nudge sets a flag that the next step clears', () => {
    const store = createTutorialStore();
    store.getState().begin(1, [select, tap]);
    store.getState().nudge();
    expect(store.getState().nudged).toBe(true);
    store.getState().advance();
    expect(store.getState().nudged).toBe(false);
  });

  it('end clears everything', () => {
    const store = createTutorialStore();
    store.getState().begin(1, [select]);
    store.getState().nudge();
    store.getState().end();
    expect(store.getState()).toMatchObject({
      levelId: null,
      steps: [],
      index: 0,
      nudged: false,
    });
  });

  it('begin starts over even after progress was made', () => {
    const store = createTutorialStore();
    store.getState().begin(1, [select, tap]);
    store.getState().advance();
    store.getState().begin(1, [select, tap]);
    expect(currentStep(store.getState())).toBe(select);
  });
});
