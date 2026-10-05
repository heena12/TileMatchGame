import type { Command } from '../commands/commands';
import type { GameEvent, RejectReason } from '../events/events';
import { isFree } from './board';
import { REVIVE_UNDO, TRAY_SIZE } from './rules';
import { canShuffleBoard, shuffleBoard } from './shuffle';
import { extractMatch, insertTile } from './tray';
import type { GameState, GameStatus } from './types';

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  readonly accepted: boolean;
}

function reject(state: GameState, reason: RejectReason): StepResult {
  return {
    state,
    events: [{ type: 'COMMAND_REJECTED', reason }],
    accepted: false,
  };
}

/** The only place game state transitions happen. Pure: no I/O, randomness or clock. */
export function applyCommand(state: GameState, command: Command): StepResult {
  switch (command.type) {
    case 'SELECT_TILE':
      return selectTile(state, command.tileId);
    case 'UNDO':
      return undo(state);
    case 'SHUFFLE':
      return shuffle(state, command.seed);
    case 'HINT':
      return hint(state);
    case 'REVIVE':
      return revive(state);
  }
}

function selectTile(state: GameState, tileId: number): StepResult {
  if (state.status !== 'playing') {
    return reject(state, 'GAME_NOT_ACTIVE');
  }
  const tile = state.board.find(t => t.id === tileId);
  if (!tile) {
    return reject(state, 'TILE_NOT_FOUND');
  }
  if (!isFree(tile, state.board)) {
    return reject(state, 'TILE_BLOCKED');
  }

  const board = state.board.filter(t => t.id !== tileId);
  const inserted = insertTile(state.tray, tile);
  const events: GameEvent[] = [
    {
      type: 'TILE_SELECTED',
      tileId,
      typeId: tile.typeId,
      trayIndex: inserted.findIndex(t => t.id === tileId),
    },
  ];

  const { tray, matched } = extractMatch(inserted);
  if (matched.length > 0) {
    events.push({
      type: 'TILES_MATCHED',
      typeId: tile.typeId,
      tileIds: matched.map(t => t.id),
    });
  }

  let status: GameStatus = 'playing';
  if (board.length === 0 && tray.length === 0) {
    status = 'won';
    events.push({ type: 'LEVEL_COMPLETED', levelId: state.levelId });
  } else if (tray.length >= TRAY_SIZE) {
    status = 'lost';
    events.push({ type: 'GAME_OVER', levelId: state.levelId });
  }

  return {
    state: {
      ...state,
      status,
      board,
      tray,
      moves: state.moves + 1,
      // What the game looked like before this tap, so Undo can put it back.
      history: [
        ...state.history,
        {
          board: state.board,
          tray: state.tray,
          tileId,
          typeId: tile.typeId,
        },
      ],
    },
    events,
    accepted: true,
  };
}

/** Puts back the game as it was before the last selection, including a match it caused. */
function undo(state: GameState): StepResult {
  if (state.status !== 'playing') {
    return reject(state, 'GAME_NOT_ACTIVE');
  }
  const frame = state.history[state.history.length - 1];
  if (!frame) {
    return reject(state, 'NOTHING_TO_UNDO');
  }
  return {
    state: {
      ...state,
      board: frame.board,
      tray: frame.tray,
      moves: state.moves - 1,
      history: state.history.slice(0, -1),
    },
    events: [
      { type: 'SELECTION_UNDONE', tileId: frame.tileId, typeId: frame.typeId },
    ],
    accepted: true,
  };
}

/**
 * Re-deals the pictures on the remaining tiles. Earlier positions in the
 * history hold the old pictures, so undoing past a shuffle would be
 * inconsistent: the history is cleared.
 */
function shuffle(state: GameState, seed: number): StepResult {
  if (state.status !== 'playing') {
    return reject(state, 'GAME_NOT_ACTIVE');
  }
  if (!canShuffleBoard(state.board)) {
    return reject(state, 'NOTHING_TO_SHUFFLE');
  }
  return {
    state: { ...state, board: shuffleBoard(state, seed), history: [] },
    events: [{ type: 'BOARD_SHUFFLED' }],
    accepted: true,
  };
}

/** Changes nothing; accepted so the log shows a hint was used. */
function hint(state: GameState): StepResult {
  if (state.status !== 'playing') {
    return reject(state, 'GAME_NOT_ACTIVE');
  }
  return { state, events: [{ type: 'HINT_USED' }], accepted: true };
}

/**
 * A second chance: on a lost game, take back the last few selections (as many
 * as the history holds, up to REVIVE_UNDO) and carry on. Every earlier state
 * was a playing one, so the restored game is never already lost.
 */
function revive(state: GameState): StepResult {
  if (state.status !== 'lost') {
    return reject(state, 'GAME_NOT_ACTIVE');
  }
  const count = Math.min(REVIVE_UNDO, state.history.length);
  const frame = state.history[state.history.length - count];
  if (!frame) {
    return reject(state, 'NOTHING_TO_UNDO');
  }
  return {
    state: {
      ...state,
      status: 'playing',
      board: frame.board,
      tray: frame.tray,
      moves: state.moves - count,
      history: state.history.slice(0, state.history.length - count),
    },
    events: [{ type: 'GAME_REVIVED', undone: count }],
    accepted: true,
  };
}
