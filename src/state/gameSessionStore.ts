import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import { initialScoreState } from '@engine';
import type {
  GameEvent,
  GameState,
  LevelReward,
  ScoreState,
  Tile,
} from '@engine';

/**
 * Thin cache of what the UI needs to render the current session.
 * Holds NO game rules: the snapshot comes from the engine, changes come from
 * the GameController.
 */
export type SessionStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'won'
  | 'lost'
  | 'error';

/**
 * One tap, described for presentation. `seq` rises with every step so effects
 * can tell a new step from a re-render. Rejected taps get a step too.
 */
export interface StepRecord {
  readonly seq: number;
  /** Combo level after this step; the animation adds a crown above 0. */
  readonly comboLevel?: number;
  readonly events: readonly GameEvent[];
  /** The tile the tap referred to, if it existed. */
  readonly tile: Tile | null;
  /** Tray contents before this step. */
  readonly trayBefore: readonly Tile[];
}

export interface GameSessionData {
  readonly levelId: number | null;
  readonly status: SessionStatus;
  readonly game: GameState | null;
  readonly freeTileIds: readonly number[];
  readonly score: ScoreState;
  /** Set on a win: stars and coins earned. */
  readonly result: LevelReward | null;
  /** Revives used on this attempt; the first one is free. */
  readonly revivesUsed: number;
  /** Coins from completing a picture this run; 0 when none. */
  readonly puzzleBonus: number;
  readonly errorMessage: string | null;
  readonly lastStep: StepRecord | null;
  /** Tiles the Wand is about to collect, glowing until the first one is sent. */
  readonly wandTileIds: readonly number[];
}

export interface GameSessionState extends GameSessionData {
  patch(changes: Partial<GameSessionData>): void;
  reset(): void;
}

export type GameSessionStore = StoreApi<GameSessionState>;

const initial: GameSessionData = {
  levelId: null,
  status: 'idle',
  game: null,
  freeTileIds: [],
  score: initialScoreState,
  result: null,
  puzzleBonus: 0,
  revivesUsed: 0,
  errorMessage: null,
  lastStep: null,
  wandTileIds: [],
};

export function createGameSessionStore(): GameSessionStore {
  return createStore<GameSessionState>(set => ({
    ...initial,
    patch: changes => set(changes),
    reset: () => set(initial),
  }));
}
