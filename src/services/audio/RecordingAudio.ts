import type { IAudio, SoundCue } from './IAudio';

/** Keeps played cues in memory. Used by tests. */
export class RecordingAudio implements IAudio {
  readonly played: SoundCue[] = [];
  /** Spoken praise lines, in order. */
  readonly spoken: string[] = [];
  /** Whether background music is on right now. */
  musicOn = false;

  play(cue: SoundCue): void {
    this.played.push(cue);
  }

  speak(text: string): void {
    this.spoken.push(text);
  }

  startMusic(): void {
    this.musicOn = true;
  }

  stopMusic(): void {
    this.musicOn = false;
  }
}
