import type { GameEvent } from '@engine';
import type { IAudio, SoundCue } from '@services/audio/IAudio';
import type { HapticKind, IHaptics } from '@services/haptics/IHaptics';
import type { SettingsStore } from './settingsStore';

/** What the player should notice. One cue maps to one sound and one haptic. */
export type Cue = SoundCue;

export interface IFeedback {
  play(cues: readonly Cue[]): void;
  /** Starts or stops background music to match the Music setting. */
  syncMusic?(): void;
  /** Gets sound ready before the first move, so that move does not stall. */
  prime?(): void;
  /** A spoken praise line; honours the sound setting. */
  speak?(text: string): void;
}

/**
 * Pure: which cues one engine step deserves, in order. A match at combo level
 * 1 or more plays the combo sound instead of the plain match sound.
 */
export function cuesForEvents(
  events: readonly GameEvent[],
  comboLevel: number,
): Cue[] {
  const cues: Cue[] = [];
  for (const event of events) {
    switch (event.type) {
      case 'TILE_SELECTED':
        cues.push('select');
        break;
      case 'TILES_MATCHED':
        cues.push(comboLevel > 0 ? 'combo' : 'match');
        break;
      case 'LEVEL_COMPLETED':
        cues.push('win');
        break;
      case 'GAME_OVER':
        cues.push('lose');
        break;
      case 'COMMAND_REJECTED':
        cues.push('reject');
        break;
      case 'SELECTION_UNDONE':
        cues.push('undo');
        break;
      case 'BOARD_SHUFFLED':
        cues.push('shuffle');
        break;
      case 'HINT_USED':
        cues.push('hint');
        break;
      case 'GAME_REVIVED':
        cues.push('shuffle');
        break;
    }
  }
  return cues;
}

export const HAPTIC_FOR_CUE: Readonly<Record<Cue, HapticKind>> = {
  select: 'light',
  match: 'medium',
  combo: 'medium',
  reject: 'error',
  win: 'success',
  lose: 'error',
  undo: 'light',
  shuffle: 'medium',
  hint: 'light',
};

export interface FeedbackDeps {
  audio: IAudio;
  haptics: IHaptics;
  settings: SettingsStore;
}

/** Plays cues through audio and haptics, honouring the player's settings at the moment of play. */
export class FeedbackPlayer implements IFeedback {
  constructor(private readonly deps: FeedbackDeps) {}

  play(cues: readonly Cue[]): void {
    const { audio, haptics, settings } = this.deps;
    const { soundEnabled, hapticsEnabled } = settings.getState();
    for (const cue of cues) {
      if (soundEnabled) {
        audio.play(cue);
      }
      if (hapticsEnabled) {
        haptics.trigger(HAPTIC_FOR_CUE[cue]);
      }
    }
  }

  prime(): void {
    const { soundEnabled, voiceEnabled, musicEnabled } =
      this.deps.settings.getState();
    if (soundEnabled || voiceEnabled || musicEnabled) {
      this.deps.audio.prime?.();
    }
  }

  syncMusic(): void {
    if (this.deps.settings.getState().musicEnabled) {
      this.deps.audio.startMusic?.();
    } else {
      this.deps.audio.stopMusic?.();
    }
  }

  speak(text: string): void {
    if (this.deps.settings.getState().voiceEnabled) {
      this.deps.audio.speak?.(text);
    }
  }
}
