import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { Command } from '@engine';
import type { IStorage } from '@services/storage/IStorage';
import { STORAGE_KEYS } from '@services/storage/keys';
import { readVersioned } from './persistence/migrations';
import type { Doc } from './persistence/migrations';

/** Current shape of the saved-game document (GAME_DESIGN 13.6). */
export const SAVED_GAME_SCHEMA_VERSION = 1;

/** The level being played, described so it can be replayed exactly. */
export interface SavedGame {
  readonly levelId: number;
  /** Fingerprint of the level's content; the save is dropped if it no longer matches. */
  readonly levelContentVersion: string;
  /** Accepted commands in order. Replaying them through the engine rebuilds the game. */
  readonly commands: readonly Command[];
}

/** The little the UI needs to offer "Resume". */
export interface SavedGameSummary {
  readonly levelId: number;
  readonly moves: number;
}

export interface SavedGameState {
  readonly summary: SavedGameSummary | null;
  /** The full saved game, read straight from storage. */
  read(): SavedGame | null;
  save(game: SavedGame): void;
  clear(): void;
}

export type SavedGameStore = StoreApi<SavedGameState>;

/** One stored command, or null if it is not a command we know how to replay. */
function parseCommand(item: unknown): Command | null {
  const c = item as Partial<{
    type: unknown;
    tileId: unknown;
    seed: unknown;
  }> | null;
  if (!c) {
    return null;
  }
  switch (c.type) {
    case 'SELECT_TILE':
      return typeof c.tileId === 'number' && Number.isInteger(c.tileId)
        ? { type: 'SELECT_TILE', tileId: c.tileId }
        : null;
    case 'SHUFFLE':
      return typeof c.seed === 'number' && Number.isInteger(c.seed)
        ? { type: 'SHUFFLE', seed: c.seed }
        : null;
    case 'UNDO':
      return { type: 'UNDO' };
    case 'HINT':
      return { type: 'HINT' };
    case 'REVIVE':
      return { type: 'REVIVE' };
    default:
      return null;
  }
}

export function parseCommands(raw: unknown): Command[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }
  const commands: Command[] = [];
  for (const item of raw) {
    const command = parseCommand(item);
    if (!command) {
      return null;
    }
    commands.push(command);
  }
  return commands;
}

/** Turns a stored document into a SavedGame, or null if it is missing or unusable. */
function readGame(storage: IStorage): SavedGame | null {
  const outcome = readVersioned(
    storage.getString(STORAGE_KEYS.inProgressGame),
    SAVED_GAME_SCHEMA_VERSION,
    {},
  );
  if (outcome.kind !== 'ok') {
    return null;
  }
  const doc: Doc = outcome.doc;
  const commands = parseCommands(doc.commands);
  if (
    typeof doc.levelId !== 'number' ||
    !Number.isInteger(doc.levelId) ||
    doc.levelId < 1 ||
    typeof doc.levelContentVersion !== 'string' ||
    doc.levelContentVersion.length === 0 ||
    commands === null
  ) {
    return null;
  }
  return {
    levelId: doc.levelId,
    levelContentVersion: doc.levelContentVersion,
    commands,
  };
}

const summaryOf = (game: SavedGame | null): SavedGameSummary | null =>
  game ? { levelId: game.levelId, moves: game.commands.length } : null;

/**
 * Device-local record of the level in progress. Written after every accepted
 * move, so it is safe if the app is killed at any moment.
 */
export function createSavedGameStore(storage: IStorage): SavedGameStore {
  return createStore<SavedGameState>(set => ({
    summary: summaryOf(readGame(storage)),
    read: () => readGame(storage),
    save: game => {
      storage.setString(
        STORAGE_KEYS.inProgressGame,
        JSON.stringify({ schemaVersion: SAVED_GAME_SCHEMA_VERSION, ...game }),
      );
      set({ summary: summaryOf(game) });
    },
    clear: () => {
      if (storage.contains(STORAGE_KEYS.inProgressGame)) {
        storage.delete(STORAGE_KEYS.inProgressGame);
      }
      set({ summary: null });
    },
  }));
}
