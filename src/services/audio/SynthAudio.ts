import type { IAudio, SoundCue } from './IAudio';

/**
 * The small slice of the Web Audio API we use. The browser's AudioContext and
 * react-native-audio-api's AudioContext both satisfy it, so one synthesizer
 * serves web, Android and iOS with no sound files to ship.
 */
export interface AudioParamLike {
  value: number;
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
}

export interface OscillatorLike {
  type: string;
  frequency: AudioParamLike;
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface GainLike {
  gain: AudioParamLike;
  connect(destination: unknown): unknown;
}

export interface AudioContextLike {
  readonly currentTime: number;
  readonly destination: unknown;
  readonly state?: string;
  createOscillator(): OscillatorLike;
  createGain(): GainLike;
  resume?(): unknown;
}

interface Note {
  readonly freq: number;
  /** Seconds after the cue starts. */
  readonly at: number;
  readonly duration: number;
  readonly wave: 'sine' | 'triangle' | 'square' | 'sawtooth';
  readonly volume: number;
}

const note = (
  freq: number,
  at: number,
  duration: number,
  wave: Note['wave'] = 'triangle',
  volume = 0.22,
): Note => ({ freq, at, duration, wave, volume });

// Equal-temperament pitches: C4 261.63, E4 329.63, G4 392.00, C5 523.25,
// E5 659.25, G5 783.99, B5 987.77, C6 1046.5, E6 1318.5.
export const CUE_NOTES: Readonly<Record<SoundCue, readonly Note[]>> = {
  // A short two-layer wooden click: body plus a bright edge.
  select: [
    note(210, 0, 0.055, 'triangle', 0.16),
    note(920, 0.012, 0.065, 'sine', 0.13),
  ],
  match: [
    // Wait for the selected tile to reach the tray (about 0.26 s) before the sparkle chord.
    note(523.25, 0.26, 0.12, 'sine', 0.2),
    note(659.25, 0.32, 0.14, 'sine', 0.2),
    note(783.99, 0.38, 0.2, 'triangle', 0.22),
    note(1046.5, 0.45, 0.24, 'sine', 0.14),
  ],
  combo: [
    note(659.25, 0.26, 0.09, 'sine', 0.2),
    note(783.99, 0.33, 0.1, 'sine', 0.21),
    note(987.77, 0.4, 0.12, 'triangle', 0.22),
    note(1318.5, 0.48, 0.28, 'sine', 0.18),
  ],
  reject: [note(160, 0, 0.16, 'sawtooth', 0.18)],
  // Two notes stepping down: something was taken back.
  undo: [note(523.25, 0, 0.08), note(392, 0.08, 0.14)],
  // A quick rising flutter: the tiles are being dealt again.
  shuffle: [
    note(392, 0, 0.05),
    note(523.25, 0.05, 0.05),
    note(659.25, 0.1, 0.05),
    note(783.99, 0.15, 0.05),
    note(987.77, 0.2, 0.12),
  ],
  // One bright ping, higher than a tap.
  hint: [note(1174.66, 0, 0.12, 'sine', 0.2)],
  win: [
    note(523.25, 0.34, 0.14, 'triangle', 0.2),
    note(659.25, 0.46, 0.14, 'triangle', 0.21),
    note(783.99, 0.58, 0.16, 'triangle', 0.22),
    note(1046.5, 0.72, 0.45, 'sine', 0.24),
    note(783.99, 0.74, 0.42, 'sine', 0.13),
    note(1318.5, 0.82, 0.3, 'sine', 0.12),
  ],
  lose: [
    note(392, 0, 0.18),
    note(329.63, 0.18, 0.18),
    note(261.63, 0.36, 0.34),
  ],
};

interface MusicChord {
  readonly root: number;
  readonly tones: readonly [number, number, number];
}

/** A - F - C - G, the loop under the game. */
const MUSIC_CHORDS: readonly MusicChord[] = [
  { root: 110, tones: [440, 523.25, 659.25] },
  { root: 87.31, tones: [349.23, 440, 523.25] },
  { root: 130.81, tones: [523.25, 659.25, 783.99] },
  { root: 98, tones: [392, 493.88, 587.33] },
];
/** Which chord tone each eighth note of a bar plays. */
const MUSIC_PATTERN = [0, 2, 1, 2, 0, 2, 1, 2] as const;
const MUSIC_BAR_S = 2.4;
const MUSIC_LOOKAHEAD_S = 2;
const MUSIC_TICK_MS = 500;

/**
 * Plays every cue as a few short oscillator notes. The context is created on
 * the first play (browsers only allow audio after a user gesture, and a tap is
 * what triggers the first sound). Any failure switches sound off quietly.
 */
export class SynthAudio implements IAudio {
  private context: AudioContextLike | null = null;
  private broken = false;
  private music: {
    timer: ReturnType<typeof setInterval>;
    master: GainLike;
    next: number;
    bar: number;
  } | null = null;

  constructor(private readonly createContext: () => AudioContextLike) {}

  prime(): void {
    if (this.broken || this.context) {
      return;
    }
    try {
      this.context = this.createContext();
      if (this.context.state === 'suspended') {
        this.context.resume?.();
      }
    } catch {
      this.broken = true;
    }
  }

  play(cue: SoundCue): void {
    if (this.broken) {
      return;
    }
    try {
      const context = this.context ?? (this.context = this.createContext());
      if (context.state === 'suspended') {
        context.resume?.();
      }
      const start = context.currentTime;
      for (const n of CUE_NOTES[cue]) {
        this.schedule(context, n, start + n.at);
      }
    } catch {
      this.broken = true;
    }
  }

  /**
   * Soft looping background music: a slow four-chord loop with a held bass and
   * a gentle arpeggio, scheduled a couple of seconds ahead so it never gaps.
   */
  startMusic(): void {
    if (this.broken || this.music) {
      return;
    }
    try {
      const context = this.context ?? (this.context = this.createContext());
      const master = context.createGain();
      master.gain.setValueAtTime(0, context.currentTime);
      master.gain.linearRampToValueAtTime(1, context.currentTime + 1.5);
      master.connect(context.destination);
      const state = {
        timer: setInterval(() => this.fillMusic(), MUSIC_TICK_MS),
        master,
        next: context.currentTime + 0.2,
        bar: 0,
      };
      this.music = state;
      this.fillMusic();
    } catch {
      this.broken = true;
    }
  }

  stopMusic(): void {
    const music = this.music;
    this.music = null;
    if (!music) {
      return;
    }
    clearInterval(music.timer);
    try {
      const now = this.context?.currentTime ?? 0;
      music.master.gain.setValueAtTime(1, now);
      music.master.gain.linearRampToValueAtTime(0, now + 0.4);
    } catch {
      // The context is gone; nothing is playing.
    }
  }

  private fillMusic(): void {
    const music = this.music;
    const context = this.context;
    if (!music || !context) {
      return;
    }
    while (music.next < context.currentTime + MUSIC_LOOKAHEAD_S) {
      const chord = MUSIC_CHORDS[music.bar % MUSIC_CHORDS.length];
      if (chord) {
        this.scheduleBar(context, music.master, chord, music.next);
      }
      music.next += MUSIC_BAR_S;
      music.bar++;
    }
  }

  private scheduleBar(
    context: AudioContextLike,
    out: GainLike,
    chord: MusicChord,
    start: number,
  ): void {
    const eighth = MUSIC_BAR_S / 8;
    this.schedule(
      context,
      note(chord.root, 0, MUSIC_BAR_S * 0.48, 'sine', 0.07),
      start,
      out,
    );
    this.schedule(
      context,
      note(chord.root, 0, MUSIC_BAR_S * 0.48, 'sine', 0.07),
      start + MUSIC_BAR_S / 2,
      out,
    );
    MUSIC_PATTERN.forEach((toneIndex, i) => {
      const freq = chord.tones[toneIndex];
      if (freq !== undefined) {
        this.schedule(
          context,
          note(freq, 0, eighth * 1.6, 'triangle', 0.045),
          start + i * eighth,
          out,
        );
      }
    });
  }

  private schedule(
    context: AudioContextLike,
    n: Note,
    when: number,
    out?: GainLike,
  ): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = n.wave;
    oscillator.frequency.value = n.freq;
    // Short attack and linear fade to avoid clicks.
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(n.volume, when + 0.008);
    gain.gain.linearRampToValueAtTime(0, when + n.duration);
    oscillator.connect(gain);
    gain.connect(out ?? context.destination);
    oscillator.start(when);
    oscillator.stop(when + n.duration + 0.02);
  }
}
