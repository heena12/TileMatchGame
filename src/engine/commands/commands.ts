import type { TileId } from '../core/types';

/** Commands are plain serializable data so they can be logged, sent and replayed. */
export interface SelectTileCommand {
  readonly type: 'SELECT_TILE';
  readonly tileId: TileId;
}

/** Takes back the most recent selection (booster). Cannot go back past a shuffle. */
export interface UndoCommand {
  readonly type: 'UNDO';
}

/**
 * Re-deals the tile types among the tiles left on the board (booster). The
 * seed is part of the command, so replaying the log gives the same result.
 */
export interface ShuffleCommand {
  readonly type: 'SHUFFLE';
  readonly seed: number;
}

/**
 * Asks for a hint (booster). It changes nothing in the game; it is a command
 * so that the log records that a booster was used, which the "no boosters"
 * star rule can then verify from the log alone.
 */
export interface HintCommand {
  readonly type: 'HINT';
}

/**
 * A second chance after the tray fills up (booster). Only valid on a lost game:
 * it takes back the last few selections so the tray has room again and the game
 * goes on. The log records it, so a revived run replays and verifies exactly.
 */
export interface ReviveCommand {
  readonly type: 'REVIVE';
}

export type Command =
  | SelectTileCommand
  | UndoCommand
  | ShuffleCommand
  | HintCommand
  | ReviveCommand;

/** Commands that count as using a booster. */
export function isBoosterCommand(command: Command): boolean {
  return command.type !== 'SELECT_TILE';
}
