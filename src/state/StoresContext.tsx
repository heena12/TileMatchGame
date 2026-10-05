import React, { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { SettingsState, SettingsStore } from './settingsStore';
import type { GameSessionState, GameSessionStore } from './gameSessionStore';
import type { ProgressState, ProgressStore } from './progressStore';
import type { GameController } from './gameController';
import type { ILeaderboardService } from '@services/leaderboard/ILeaderboardService';
import type { ReminderService } from './reminders/ReminderService';
import type { SyncService } from './sync/SyncService';
import type { SyncState, SyncStore } from './sync/syncStore';
import type { TutorialState, TutorialStore } from './tutorialStore';
import type { SavedGameState, SavedGameStore } from './savedGameStore';

export interface Stores {
  settings: SettingsStore;
  gameSession: GameSessionStore;
  progress: ProgressStore;
  tutorial: TutorialStore;
  savedGame: SavedGameStore;
  sync: SyncStore;
}

/** Everything the UI is allowed to reach, built once by the composition root. */
export interface AppModel {
  stores: Stores;
  controller: GameController;
  syncService: SyncService;
  reminders: ReminderService;
  leaderboard: ILeaderboardService;
}

const AppModelContext = createContext<AppModel | null>(null);

export function AppModelProvider({
  model,
  children,
}: {
  model: AppModel;
  children: React.ReactNode;
}) {
  return (
    <AppModelContext.Provider value={model}>
      {children}
    </AppModelContext.Provider>
  );
}

function useModel(): AppModel {
  const model = useContext(AppModelContext);
  if (!model) {
    throw new Error('AppModelProvider is missing');
  }
  return model;
}

export function useSettings<T>(selector: (s: SettingsState) => T): T {
  return useStore(useModel().stores.settings, selector);
}

export function useGameSession<T>(selector: (s: GameSessionState) => T): T {
  return useStore(useModel().stores.gameSession, selector);
}

export function useProgress<T>(selector: (s: ProgressState) => T): T {
  return useStore(useModel().stores.progress, selector);
}

export function useTutorial<T>(selector: (s: TutorialState) => T): T {
  return useStore(useModel().stores.tutorial, selector);
}

export function useSavedGame<T>(selector: (s: SavedGameState) => T): T {
  return useStore(useModel().stores.savedGame, selector);
}

/** Status of cloud saving: whether it is connected, syncing, offline, and so on. */
export function useSync<T>(selector: (s: SyncState) => T): T {
  return useStore(useModel().stores.sync, selector);
}

export function useSyncService(): SyncService {
  return useModel().syncService;
}

export function useReminders(): ReminderService {
  return useModel().reminders;
}

export function useLeaderboard(): ILeaderboardService {
  return useModel().leaderboard;
}

export function useGameController(): GameController {
  return useModel().controller;
}
