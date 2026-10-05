import type { IClock, ILevelSource, IRandom, LevelData } from '@engine';
import { APP_CONFIG } from '@config/constants';
import type { IAnalytics } from '@services/analytics/IAnalytics';
import type { ICloudSaveService } from '@services/cloud/ICloudSaveService';
import { NoopCloudSave } from '@services/cloud/NoopCloudSave';
import type { ILeaderboardService } from '@services/leaderboard/ILeaderboardService';
import { NoopLeaderboard } from '@services/leaderboard/NoopLeaderboard';
import { NoopAnalytics } from '@services/analytics/NoopAnalytics';
import type { IAudio } from '@services/audio/IAudio';
import { createAudio } from '@services/audio/createAudio';
import { SystemClock } from '@services/clock/SystemClock';
import type { IAppLifecycle } from '@services/lifecycle/IAppLifecycle';
import { AppStateLifecycle } from '@services/lifecycle/AppStateLifecycle';
import type { INotificationService } from '@services/notifications/INotificationService';
import { createNotifications } from '@services/notifications/createNotifications';
import type { IHaptics } from '@services/haptics/IHaptics';
import { VibrationHaptics } from '@services/haptics/VibrationHaptics';
import type { IStorage } from '@services/storage/IStorage';
import { createLevelSource } from '@services/levels/createLevelSource';
import { MathRandom } from '@services/random/MathRandom';
import { createDefaultStorage } from '@services/storage/createDefaultStorage';
import { FeedbackPlayer } from '@state/feedback';
import { GameController } from '@state/gameController';
import { createGameSessionStore } from '@state/gameSessionStore';
import { createProgressStore } from '@state/progressStore';
import { createSavedGameStore } from '@state/savedGameStore';
import { createSettingsStore } from '@state/settingsStore';
import { setLanguage } from '@ui/i18n/strings';
import { ReminderService } from '@state/reminders/ReminderService';
import { RunReporter } from '@state/sync/RunReporter';
import { SyncService } from '@state/sync/SyncService';
import { createSyncStore } from '@state/sync/syncStore';
import { t } from '@ui/i18n/strings';
import { createTutorialStore } from '@state/tutorialStore';
import type { AppModel } from '@state/StoresContext';

export interface Container {
  storage: IStorage;
  analytics: IAnalytics;
  model: AppModel;
  reminders: ReminderService;
  /** Begins background work (cloud sync, sending queued runs). Returns a function that stops it. */
  start(): () => void;
}

export interface ContainerOptions {
  storage?: IStorage;
  analytics?: IAnalytics;
  clock?: IClock;
  levelSource?: ILevelSource<LevelData>;
  audio?: IAudio;
  haptics?: IHaptics;
  random?: IRandom;
  /** Local reminders. Defaults to the native module, or nothing where unavailable. */
  notifications?: INotificationService;
  /** App foreground / background events. */
  lifecycle?: IAppLifecycle;
  /** Cloud save provider. Defaults to "not connected". */
  cloud?: ICloudSaveService;
  /** Leaderboard provider. Defaults to "not connected". */
  leaderboard?: ILeaderboardService;
}

/**
 * Composition root: the only place concrete services are constructed.
 * Every dependency can be replaced, which is how tests run without native code.
 */
export function createContainer(options: ContainerOptions = {}): Container {
  const storage = options.storage ?? createDefaultStorage(APP_CONFIG.storageId);
  const analytics = options.analytics ?? new NoopAnalytics();
  const clock = options.clock ?? new SystemClock();
  const levelSource = options.levelSource ?? createLevelSource();
  const audio = options.audio ?? createAudio();
  const haptics = options.haptics ?? new VibrationHaptics();

  const settings = createSettingsStore(storage);
  // Text follows the saved language from the first frame, and any change in Settings.
  setLanguage(settings.getState().language);
  settings.subscribe(state => setLanguage(state.language));
  const gameSession = createGameSessionStore();
  const progress = createProgressStore(storage, clock);
  const tutorial = createTutorialStore();
  const savedGame = createSavedGameStore(storage);
  const cloud = options.cloud ?? new NoopCloudSave();
  const leaderboard = options.leaderboard ?? new NoopLeaderboard();
  const sync = createSyncStore(cloud.isAvailable ? 'idle' : 'unavailable');
  const syncService = new SyncService({ cloud, progress, store: sync, clock });
  const reminders = new ReminderService({
    notifications:
      options.notifications ?? createNotifications(t('notify.channel')),
    lifecycle: options.lifecycle ?? new AppStateLifecycle(),
    settings,
    progress,
    storage,
    clock,
  });
  const reporter = new RunReporter({ leaderboard, storage, clock });
  const feedback = new FeedbackPlayer({ audio, haptics, settings });
  const controller = new GameController({
    levelSource,
    analytics,
    session: gameSession,
    progress,
    feedback,
    tutorial,
    savedGame,
    random: options.random ?? new MathRandom(),
    onRunCompleted: ({ claim, newBest }) => {
      // Only a new personal best can change a leaderboard.
      if (newBest && leaderboard.isAvailable) {
        reporter.enqueue(claim);
        reporter.flush().catch(() => undefined);
      }
    },
  });

  return {
    storage,
    analytics,
    reminders,
    model: {
      stores: {
        settings,
        gameSession,
        progress,
        tutorial,
        savedGame,
        sync,
      },
      controller,
      syncService,
      reminders,
      leaderboard,
    },
    start: () => {
      reporter.flush().catch(() => undefined);
      const stopSync = syncService.start();
      const stopReminders = reminders.start();
      return () => {
        stopSync();
        stopReminders();
      };
    },
  };
}
