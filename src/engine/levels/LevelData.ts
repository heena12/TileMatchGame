import type { LevelDefinition } from '../core/types';

export const LEVEL_SCHEMA_VERSION = 1;

/** What a tutorial step waits for: a tap on a highlighted tile, or a "Got it" press. */
export type TutorialWait = 'select' | 'tap';

/**
 * One guided step (GAME_DESIGN 13.5). The engine never interprets it: it only
 * carries the data to the UI. `messageKey` is a string-table key.
 */
export interface TutorialStep {
  readonly highlightTileIds: readonly number[];
  readonly messageKey: string;
  readonly waitFor: TutorialWait;
}

/** Serializable level as stored in JSON or produced by the generator. */
export interface LevelData extends LevelDefinition {
  readonly schemaVersion: number;
  readonly twoStarScore: number;
  readonly threeStarScore: number;
  readonly noBoosters?: boolean;
  /** Spare tray slots verified for this level (see GAME_DESIGN 13.3). */
  readonly validatedSlack: number;
  /** Guided steps for the first levels. Absent for normal levels. */
  readonly tutorial?: readonly TutorialStep[];
}

export class LevelDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LevelDataError';
  }
}

export class LevelNotFoundError extends Error {
  constructor(readonly levelId: number) {
    super(`Level ${levelId} not found`);
    this.name = 'LevelNotFoundError';
  }
}
