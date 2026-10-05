import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { TutorialStep } from '@engine';

export interface TutorialData {
  readonly levelId: number | null;
  readonly steps: readonly TutorialStep[];
  /** Index of the step being shown. `>= steps.length` means guidance is over. */
  readonly index: number;
  /** True once the player tried something the current step does not allow. */
  readonly nudged: boolean;
}

export interface TutorialState extends TutorialData {
  begin(levelId: number, steps: readonly TutorialStep[]): void;
  advance(): void;
  nudge(): void;
  end(): void;
}

export type TutorialStore = StoreApi<TutorialState>;

const idle: TutorialData = {
  levelId: null,
  steps: [],
  index: 0,
  nudged: false,
};

/** The step to show now, or null when there is no guidance. */
export function currentStep(
  state: Pick<TutorialData, 'steps' | 'index'>,
): TutorialStep | null {
  return state.steps[state.index] ?? null;
}

/**
 * During a "select" step only the highlighted tiles may be tapped. During a
 * "tap" step the board is locked until the player presses "Got it".
 */
export function stepAllowsTile(step: TutorialStep, tileId: number): boolean {
  return step.waitFor === 'select' && step.highlightTileIds.includes(tileId);
}

export function createTutorialStore(): TutorialStore {
  return createStore<TutorialState>(set => ({
    ...idle,
    begin: (levelId, steps) => set({ levelId, steps, index: 0, nudged: false }),
    advance: () => set(s => ({ index: s.index + 1, nudged: false })),
    nudge: () => set({ nudged: true }),
    end: () => set(idle),
  }));
}
