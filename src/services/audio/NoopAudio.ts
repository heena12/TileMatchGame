import type { IAudio, SoundCue } from './IAudio';

/** Used when no audio context is available. */
export class NoopAudio implements IAudio {
  play(_cue: SoundCue): void {}
}
