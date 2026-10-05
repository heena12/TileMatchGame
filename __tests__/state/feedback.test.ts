import type { GameEvent } from '@engine';
import { RecordingAudio } from '@services/audio/RecordingAudio';
import { RecordingHaptics } from '@services/haptics/RecordingHaptics';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { FeedbackPlayer, HAPTIC_FOR_CUE, cuesForEvents } from '@state/feedback';
import type { Cue } from '@state/feedback';
import { createSettingsStore } from '@state/settingsStore';

const selected: GameEvent = {
  type: 'TILE_SELECTED',
  tileId: 1,
  typeId: 1,
  trayIndex: 0,
};
const matched: GameEvent = {
  type: 'TILES_MATCHED',
  typeId: 1,
  tileIds: [1, 2, 3],
};

describe('cuesForEvents', () => {
  it('maps each event to its cue', () => {
    expect(cuesForEvents([selected], 0)).toEqual(['select']);
    expect(
      cuesForEvents([{ type: 'COMMAND_REJECTED', reason: 'TILE_BLOCKED' }], 0),
    ).toEqual(['reject']);
    expect(cuesForEvents([{ type: 'GAME_OVER', levelId: 1 }], 0)).toEqual([
      'lose',
    ]);
    expect(cuesForEvents([{ type: 'LEVEL_COMPLETED', levelId: 1 }], 0)).toEqual(
      ['win'],
    );
  });

  it('keeps the order of a multi-event step', () => {
    const events: GameEvent[] = [
      selected,
      matched,
      { type: 'LEVEL_COMPLETED', levelId: 1 },
    ];
    expect(cuesForEvents(events, 0)).toEqual(['select', 'match', 'win']);
  });

  it('uses the combo sound for a match while a combo is running', () => {
    expect(cuesForEvents([selected, matched], 0)).toEqual(['select', 'match']);
    expect(cuesForEvents([selected, matched], 2)).toEqual(['select', 'combo']);
  });

  it('gives nothing for no events', () => {
    expect(cuesForEvents([], 0)).toEqual([]);
  });
});

describe('haptic mapping', () => {
  it('covers every cue', () => {
    const cues: Cue[] = ['select', 'match', 'combo', 'reject', 'win', 'lose'];
    cues.forEach(cue => expect(HAPTIC_FOR_CUE[cue]).toBeDefined());
  });
});

describe('FeedbackPlayer', () => {
  function setup() {
    const audio = new RecordingAudio();
    const haptics = new RecordingHaptics();
    const settings = createSettingsStore(new InMemoryStorage());
    return {
      audio,
      haptics,
      settings,
      player: new FeedbackPlayer({ audio, haptics, settings }),
    };
  }

  it('plays sound and haptics for each cue', () => {
    const { player, audio, haptics } = setup();
    player.play(['select', 'win']);
    expect(audio.played).toEqual(['select', 'win']);
    expect(haptics.triggered).toEqual(['light', 'success']);
  });

  it('respects the sound setting on its own', () => {
    const { player, audio, haptics, settings } = setup();
    settings.getState().setSoundEnabled(false);
    player.play(['match']);
    expect(audio.played).toEqual([]);
    expect(haptics.triggered).toEqual(['medium']);
  });

  it('respects the haptics setting on its own', () => {
    const { player, audio, haptics, settings } = setup();
    settings.getState().setHapticsEnabled(false);
    player.play(['reject']);
    expect(audio.played).toEqual(['reject']);
    expect(haptics.triggered).toEqual([]);
  });

  it('reads the settings at play time, so toggling takes effect immediately', () => {
    const { player, audio, settings } = setup();
    settings.getState().setSoundEnabled(false);
    player.play(['select']);
    settings.getState().setSoundEnabled(true);
    player.play(['select']);
    expect(audio.played).toEqual(['select']);
  });
});

describe('FeedbackPlayer: voice and music switches', () => {
  const setup = () => {
    const audio = new RecordingAudio();
    const spoken = audio.spoken;
    const settings = createSettingsStore(new InMemoryStorage());
    const player = new FeedbackPlayer({
      audio,
      haptics: new RecordingHaptics(),
      settings,
    });
    return { audio, spoken, settings, player };
  };

  it('speaks only while the voice is on, whatever the sound-effects switch says', () => {
    const { spoken, settings, player } = setup();
    settings.getState().setSoundEnabled(false);
    player.speak('Excellent!');
    expect(spoken).toEqual(['Excellent!']);
    settings.getState().setVoiceEnabled(false);
    player.speak('Awesome!');
    expect(spoken).toEqual(['Excellent!']);
  });

  it('starts and stops the music to match the setting', () => {
    const { audio, settings, player } = setup();
    player.syncMusic();
    expect(audio.musicOn).toBe(true);
    settings.getState().setMusicEnabled(false);
    player.syncMusic();
    expect(audio.musicOn).toBe(false);
  });
});
