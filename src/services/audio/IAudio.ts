/** Sound cues the game can ask for. Which sound each one is belongs to the implementation. */
export type SoundCue =
  | 'select'
  | 'match'
  | 'combo'
  | 'reject'
  | 'win'
  | 'lose'
  | 'undo'
  | 'shuffle'
  | 'hint';

export interface IAudio {
  /** Fire and forget. Must never throw: sound is decoration, not game logic. */
  play(cue: SoundCue): void;
  /** Optional: gentle looping background music. Safe to call repeatedly. */
  startMusic?(): void;
  stopMusic?(): void;
  /** Optional: get the sound engine ready ahead of the first sound. */
  prime?(): void;
  /** Optional voice line. Platforms without text to speech leave it out. */
  speak?(text: string): void;
}
