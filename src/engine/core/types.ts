export type TileId = number;
export type TileTypeId = number;

/** A tile occupies a 1x1 cell at (x, y) on a layer. Higher layers sit on top. */
export interface TileSpec {
  readonly id: TileId;
  /** Matching key. Art is resolved by the UI from this value. */
  readonly typeId: TileTypeId;
  readonly x: number;
  readonly y: number;
  readonly layer: number;
}

export type Tile = TileSpec;

/** Everything the engine needs to play one level. Richer level data arrives in Phase 4. */
export interface LevelDefinition {
  readonly levelId: number;
  readonly tiles: readonly TileSpec[];
  /** Opaque to the engine. */
  readonly themeId?: string;
}

export type GameStatus = 'playing' | 'won' | 'lost';

/** Immutable snapshot. Never mutated; every transition returns a new one. */
export interface GameState {
  readonly levelId: number;
  readonly status: GameStatus;
  /** Tiles still on the board. */
  readonly board: readonly Tile[];
  /** Tiles in the tray, left to right. */
  readonly tray: readonly Tile[];
  /** Selections in effect right now (an undone selection no longer counts). */
  readonly moves: number;
  /** One frame per selection that can still be undone, oldest first. */
  readonly history: readonly HistoryFrame[];
}

/** The game as it stood just before a selection, so Undo can restore it. */
export interface HistoryFrame {
  readonly board: readonly Tile[];
  readonly tray: readonly Tile[];
  /** The tile that was selected. */
  readonly tileId: TileId;
  readonly typeId: TileTypeId;
}
