import type { TileId, TileTypeId } from '../core/types';

export type RejectReason =
  | 'GAME_NOT_ACTIVE'
  | 'TILE_NOT_FOUND'
  | 'TILE_BLOCKED'
  | 'NOTHING_TO_UNDO'
  | 'NOTHING_TO_SHUFFLE';

export interface TileSelectedEvent {
  readonly type: 'TILE_SELECTED';
  readonly tileId: TileId;
  readonly typeId: TileTypeId;
  /** Tray position right after insertion, before any match is removed. */
  readonly trayIndex: number;
}

export interface TilesMatchedEvent {
  readonly type: 'TILES_MATCHED';
  readonly typeId: TileTypeId;
  readonly tileIds: readonly TileId[];
}

export interface LevelCompletedEvent {
  readonly type: 'LEVEL_COMPLETED';
  readonly levelId: number;
}

export interface GameOverEvent {
  readonly type: 'GAME_OVER';
  readonly levelId: number;
}

export interface CommandRejectedEvent {
  readonly type: 'COMMAND_REJECTED';
  readonly reason: RejectReason;
}

/** The last selection was taken back. Any match it caused is undone with it. */
export interface SelectionUndoneEvent {
  readonly type: 'SELECTION_UNDONE';
  readonly tileId: TileId;
  readonly typeId: TileTypeId;
}

export interface BoardShuffledEvent {
  readonly type: 'BOARD_SHUFFLED';
}

export interface HintUsedEvent {
  readonly type: 'HINT_USED';
}

/** A lost game was given a second chance; `undone` selections were taken back. */
export interface GameRevivedEvent {
  readonly type: 'GAME_REVIVED';
  readonly undone: number;
}

export type GameEvent =
  | TileSelectedEvent
  | TilesMatchedEvent
  | LevelCompletedEvent
  | GameOverEvent
  | CommandRejectedEvent
  | SelectionUndoneEvent
  | BoardShuffledEvent
  | HintUsedEvent
  | GameRevivedEvent;
