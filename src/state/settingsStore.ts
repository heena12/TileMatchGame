import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';
import type { IStorage } from '@services/storage/IStorage';
import { DEFAULT_LANGUAGE, isLanguageCode } from '@config/languages';
import type { LanguageCode } from '@config/languages';
import { STORAGE_KEYS } from '@services/storage/keys';

const SCHEMA_VERSION = 1;

/** Everything the player can switch in Settings. */
interface Switches {
  /** Sound effects (taps, matches, chimes). */
  soundEnabled: boolean;
  /** Vibration. */
  hapticsEnabled: boolean;
  /** Background music. */
  musicEnabled: boolean;
  /** The spoken praise ("Excellent!"). */
  voiceEnabled: boolean;
  /** High-contrast tiles: darker outlines and clearer blocked tiles. */
  colorFriendly: boolean;
  /** Come-back reminders (see ReminderService). */
  notificationsEnabled: boolean;
}

type SettingsData = Switches & {
  schemaVersion: number;
  language: LanguageCode;
};

export interface SettingsState extends Switches {
  /** The language the game is shown in. */
  language: LanguageCode;
  setLanguage(code: LanguageCode): void;
  setSoundEnabled(value: boolean): void;
  setHapticsEnabled(value: boolean): void;
  setMusicEnabled(value: boolean): void;
  setVoiceEnabled(value: boolean): void;
  setColorFriendly(value: boolean): void;
  setNotificationsEnabled(value: boolean): void;
}

export type SettingsStore = StoreApi<SettingsState>;

const DEFAULTS: Switches = {
  soundEnabled: true,
  hapticsEnabled: true,
  musicEnabled: true,
  voiceEnabled: true,
  colorFriendly: false,
  notificationsEnabled: true,
};

const KEYS = Object.keys(DEFAULTS) as (keyof Switches)[];

function load(storage: IStorage): Switches & { language: LanguageCode } {
  const raw = storage.getString(STORAGE_KEYS.settings);
  if (!raw) {
    return { ...DEFAULTS, language: DEFAULT_LANGUAGE };
  }
  try {
    const data = JSON.parse(raw) as Partial<Record<keyof Switches, unknown>> & {
      language?: unknown;
    };
    const loaded = { ...DEFAULTS, language: DEFAULT_LANGUAGE as LanguageCode };
    if (isLanguageCode(data.language)) {
      loaded.language = data.language;
    }
    for (const key of KEYS) {
      // A missing or odd value keeps its default, so older saves still load.
      if (typeof data[key] === 'boolean') {
        loaded[key] = data[key] as boolean;
      }
    }
    return loaded;
  } catch {
    return { ...DEFAULTS, language: DEFAULT_LANGUAGE };
  }
}

/** Storage is injected so tests use InMemoryStorage and the app uses MMKV. */
export function createSettingsStore(storage: IStorage): SettingsStore {
  return createStore<SettingsState>((set, get) => {
    const change = (patch: Partial<Switches & { language: LanguageCode }>) => {
      set(patch);
      const state = get();
      const data = {
        schemaVersion: SCHEMA_VERSION,
        language: state.language,
      } as SettingsData;
      for (const key of KEYS) {
        data[key] = state[key];
      }
      storage.setString(STORAGE_KEYS.settings, JSON.stringify(data));
    };
    return {
      ...load(storage),
      setLanguage: code => change({ language: code }),
      setSoundEnabled: value => change({ soundEnabled: value }),
      setHapticsEnabled: value => change({ hapticsEnabled: value }),
      setMusicEnabled: value => change({ musicEnabled: value }),
      setVoiceEnabled: value => change({ voiceEnabled: value }),
      setColorFriendly: value => change({ colorFriendly: value }),
      setNotificationsEnabled: value => change({ notificationsEnabled: value }),
    };
  });
}
