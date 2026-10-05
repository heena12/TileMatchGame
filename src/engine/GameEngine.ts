import { isBoosterCommand } from './commands/commands';
import type { Command } from './commands/commands';
import { getFreeTiles } from './core/board';
import { findCollectSet } from './core/collect';
import { findHint } from './core/hint';
import { createInitialState, validateLevel } from './core/level';
import { applyCommand } from './core/reducer';
import { canShuffleBoard } from './core/shuffle';
import type { GameState, LevelDefinition, TileId } from './core/types';
import type { GameEvent } from './events/events';

/**
 * Facade over the pure core. Owns the current snapshot and the log of accepted
 * commands. Same level + same log always yields the same state.
 */
export class GameEngine {
  private state: GameState;
  private readonly log: Command[] = [];

  constructor(readonly level: LevelDefinition) {
    validateLevel(level);
    this.state = createInitialState(level);
  }

  getState(): GameState {
    return this.state;
  }

  getFreeTileIds(): TileId[] {
    return getFreeTiles(this.state.board).map(t => t.id);
  }

  /** Accepted commands only, in order. Suitable for replay and server verification. */
  getCommandLog(): readonly Command[] {
    return [...this.log];
  }

  /** How many boosters (undo, shuffle, hint) the accepted commands used. */
  getBoostersUsed(): number {
    return this.log.filter(isBoosterCommand).length;
  }

  /** True if there is a selection to take back. */
  canUndo(): boolean {
    return this.state.status === 'playing' && this.state.history.length > 0;
  }

  /** True if shuffling would change anything. */
  canShuffle(): boolean {
    return this.state.status === 'playing' && canShuffleBoard(this.state.board);
  }

  /**
   * A tile worth tapping now. Read-only: it does not count as using a hint
   * until a HINT command is dispatched.
   */
  getHint(): TileId | null {
    return findHint(this.state);
  }

  /**
   * The tiles the Wand booster collects, in tap order, or null if there is no
   * safe set. Read-only; the booster itself is a HINT command followed by one
   * SELECT_TILE per tile, so the log stays replayable.
   */
  getCollectSet(): TileId[] | null {
    return findCollectSet(this.state);
  }

  dispatch(command: Command): readonly GameEvent[] {
    const result = applyCommand(this.state, command);
    if (result.accepted) {
      this.state = result.state;
      this.log.push(command);
    }
    return result.events;
  }

  static replay(
    level: LevelDefinition,
    commands: readonly Command[],
  ): GameEngine {
    const engine = new GameEngine(level);
    commands.forEach(c => engine.dispatch(c));
    return engine;
  }
}
