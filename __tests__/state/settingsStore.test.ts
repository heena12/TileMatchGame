import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { createSettingsStore } from '@state/settingsStore';

describe('settingsStore', () => {
  it('starts with defaults', () => {
    const s = createSettingsStore(new InMemoryStorage()).getState();
    expect(s.soundEnabled).toBe(true);
    expect(s.hapticsEnabled).toBe(true);
  });

  it('persists changes and restores them in a new store', () => {
    const storage = new InMemoryStorage();
    createSettingsStore(storage).getState().setSoundEnabled(false);
    const restored = createSettingsStore(storage).getState();
    expect(restored.soundEnabled).toBe(false);
    expect(restored.hapticsEnabled).toBe(true);
  });

  it('falls back to defaults on corrupt data', () => {
    const storage = new InMemoryStorage();
    storage.setString('player.settings', '{not json');
    expect(createSettingsStore(storage).getState().soundEnabled).toBe(true);
  });
});

describe('settingsStore: all switches', () => {
  it('starts with music, voice and notifications on, color-friendly off', () => {
    const s = createSettingsStore(new InMemoryStorage()).getState();
    expect(s.musicEnabled).toBe(true);
    expect(s.voiceEnabled).toBe(true);
    expect(s.notificationsEnabled).toBe(true);
    expect(s.colorFriendly).toBe(false);
  });

  it('saves and restores every switch', () => {
    const storage = new InMemoryStorage();
    const first = createSettingsStore(storage).getState();
    first.setMusicEnabled(false);
    first.setVoiceEnabled(false);
    first.setColorFriendly(true);
    first.setNotificationsEnabled(false);
    const restored = createSettingsStore(storage).getState();
    expect(restored.musicEnabled).toBe(false);
    expect(restored.voiceEnabled).toBe(false);
    expect(restored.colorFriendly).toBe(true);
    expect(restored.notificationsEnabled).toBe(false);
    expect(restored.soundEnabled).toBe(true);
  });

  it('loads an older save that only knew sound and haptics', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.settings',
      JSON.stringify({
        schemaVersion: 1,
        soundEnabled: false,
        hapticsEnabled: true,
      }),
    );
    const s = createSettingsStore(storage).getState();
    expect(s.soundEnabled).toBe(false);
    expect(s.musicEnabled).toBe(true);
    expect(s.colorFriendly).toBe(false);
  });

  it('ignores a value of the wrong type', () => {
    const storage = new InMemoryStorage();
    storage.setString(
      'player.settings',
      JSON.stringify({ musicEnabled: 'no' }),
    );
    expect(createSettingsStore(storage).getState().musicEnabled).toBe(true);
  });
});

describe('settingsStore: language', () => {
  it('starts in English', () => {
    expect(createSettingsStore(new InMemoryStorage()).getState().language).toBe(
      'en',
    );
  });

  it('saves the choice and restores it', () => {
    const storage = new InMemoryStorage();
    createSettingsStore(storage).getState().setLanguage('hi');
    expect(createSettingsStore(storage).getState().language).toBe('hi');
    // Other settings are untouched by it.
    expect(createSettingsStore(storage).getState().soundEnabled).toBe(true);
  });

  it('ignores a language that is not offered', () => {
    const storage = new InMemoryStorage();
    storage.setString('player.settings', JSON.stringify({ language: 'xx' }));
    expect(createSettingsStore(storage).getState().language).toBe('en');
  });
});
