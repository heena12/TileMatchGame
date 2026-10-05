import { Vibration } from 'react-native';
import { NoopAudio } from '@services/audio/NoopAudio';
import { RecordingAudio } from '@services/audio/RecordingAudio';
import { CUE_NOTES, SynthAudio } from '@services/audio/SynthAudio';
import type { AudioContextLike } from '@services/audio/SynthAudio';
import type { SoundCue } from '@services/audio/IAudio';
import { createAudio } from '@services/audio/createAudio';
import { createAudio as createWebAudio } from '@services/audio/createAudio.web';
import { NoopHaptics } from '@services/haptics/NoopHaptics';
import { RecordingHaptics } from '@services/haptics/RecordingHaptics';
import {
  HAPTIC_PATTERNS,
  VibrationHaptics,
} from '@services/haptics/VibrationHaptics';

interface Scheduled {
  type: string;
  freq: number;
  start: number;
  stop: number;
  gainPeak: number;
  connectedToDestination: boolean;
}

function fakeContext(state = 'running') {
  const scheduled: Scheduled[] = [];
  const destination = { name: 'destination' };
  let resumed = 0;
  const context: AudioContextLike = {
    currentTime: 10,
    destination,
    state,
    resume: () => {
      resumed++;
    },
    createOscillator() {
      const rec: Scheduled = {
        type: '',
        freq: 0,
        start: -1,
        stop: -1,
        gainPeak: 0,
        connectedToDestination: false,
      };
      scheduled.push(rec);
      return {
        set type(v: string) {
          rec.type = v;
        },
        get type() {
          return rec.type;
        },
        frequency: {
          set value(v: number) {
            rec.freq = v;
          },
          get value() {
            return rec.freq;
          },
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
        },
        // The synth wires oscillator -> gain -> destination; remember the gain's peak.
        connect: (g: unknown) => {
          const node = g as { peak: number; rec: Scheduled | null };
          node.rec = rec;
          rec.gainPeak = node.peak;
        },
        start: (when?: number) => {
          rec.start = when ?? 0;
        },
        stop: (when?: number) => {
          rec.stop = when ?? 0;
        },
      };
    },
    createGain() {
      const node = {
        peak: 0,
        rec: null as Scheduled | null,
        gain: {
          value: 1,
          setValueAtTime: () => undefined,
          linearRampToValueAtTime(v: number) {
            node.peak = Math.max(node.peak, v);
          },
        },
        connect: (d: unknown) => {
          if (d === destination && node.rec) {
            node.rec.connectedToDestination = true;
          }
        },
      };
      return node;
    },
  };
  return { context, scheduled, resumedCount: () => resumed };
}

describe('SynthAudio', () => {
  const cues = Object.keys(CUE_NOTES) as SoundCue[];

  it.each(cues)('schedules the notes of the %s cue', cue => {
    const { context, scheduled } = fakeContext();
    new SynthAudio(() => context).play(cue);
    expect(scheduled).toHaveLength(CUE_NOTES[cue].length);
    scheduled.forEach((s, i) => {
      const note = CUE_NOTES[cue][i]!;
      expect(s.freq).toBe(note.freq);
      expect(s.type).toBe(note.wave);
      expect(s.start).toBeCloseTo(10 + note.at);
      expect(s.stop).toBeGreaterThan(s.start);
      expect(s.gainPeak).toBe(note.volume);
    });
  });

  it('every cue has audible, in-range notes', () => {
    cues.forEach(cue => {
      expect(CUE_NOTES[cue].length).toBeGreaterThan(0);
      CUE_NOTES[cue].forEach(n => {
        expect(n.freq).toBeGreaterThan(80);
        expect(n.freq).toBeLessThan(4000);
        expect(n.volume).toBeGreaterThan(0);
        expect(n.volume).toBeLessThanOrEqual(0.5);
        expect(n.duration).toBeGreaterThan(0);
      });
    });
  });

  it('creates the context lazily and only once', () => {
    const { context } = fakeContext();
    const factory = jest.fn(() => context);
    const audio = new SynthAudio(factory);
    expect(factory).not.toHaveBeenCalled();
    audio.play('select');
    audio.play('match');
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('resumes a suspended context (browsers start audio suspended)', () => {
    const suspended = fakeContext('suspended');
    new SynthAudio(() => suspended.context).play('select');
    expect(suspended.resumedCount()).toBe(1);
    const running = fakeContext('running');
    new SynthAudio(() => running.context).play('select');
    expect(running.resumedCount()).toBe(0);
  });

  it('copes with a context that cannot resume', () => {
    const { context } = fakeContext('suspended');
    const noResume = { ...context, resume: undefined } as AudioContextLike;
    expect(() => new SynthAudio(() => noResume).play('select')).not.toThrow();
  });

  it('never throws, and stops trying after a failure', () => {
    const factory = jest.fn(() => {
      throw new Error('no audio here');
    });
    const audio = new SynthAudio(factory);
    expect(() => audio.play('select')).not.toThrow();
    expect(() => audio.play('win')).not.toThrow();
    expect(factory).toHaveBeenCalledTimes(1);
  });
});

describe('audio factories and doubles', () => {
  it('RecordingAudio keeps cues, NoopAudio does nothing', () => {
    const rec = new RecordingAudio();
    rec.play('win');
    expect(rec.played).toEqual(['win']);
    expect(() => new NoopAudio().play('win')).not.toThrow();
  });

  it('createAudio (native) always returns something safe to call', () => {
    const audio = createAudio();
    expect(() => audio.play('select')).not.toThrow();
  });

  it('createAudio (web) uses the browser AudioContext when there is one', () => {
    const scope = globalThis as unknown as { AudioContext?: unknown };
    const { context, scheduled } = fakeContext();
    scope.AudioContext = function AudioContext() {
      return context;
    };
    try {
      createWebAudio().play('select');
      expect(scheduled).toHaveLength(CUE_NOTES.select.length);
    } finally {
      delete scope.AudioContext;
    }
  });

  it('createAudio (web) falls back to webkitAudioContext, then to silence', () => {
    const scope = globalThis as unknown as {
      webkitAudioContext?: unknown;
      AudioContext?: unknown;
    };
    const { context, scheduled } = fakeContext();
    scope.webkitAudioContext = function Old() {
      return context;
    };
    try {
      createWebAudio().play('select');
      expect(scheduled).toHaveLength(CUE_NOTES.select.length);
    } finally {
      delete scope.webkitAudioContext;
    }
    const silent = createWebAudio();
    expect(silent).toBeInstanceOf(NoopAudio);
  });
});

describe('haptics', () => {
  afterEach(() => jest.restoreAllMocks());

  it('VibrationHaptics uses the documented pattern per kind', () => {
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation();
    const haptics = new VibrationHaptics();
    (['light', 'medium', 'success', 'error'] as const).forEach(kind => {
      haptics.trigger(kind);
      expect(vibrate).toHaveBeenLastCalledWith(HAPTIC_PATTERNS[kind]);
    });
    expect(vibrate).toHaveBeenCalledTimes(4);
  });

  it('VibrationHaptics swallows platform errors', () => {
    jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {
      throw new Error('unsupported');
    });
    expect(() => new VibrationHaptics().trigger('error')).not.toThrow();
  });

  it('patterns are short enough not to annoy', () => {
    Object.values(HAPTIC_PATTERNS).forEach(p => {
      const total = Array.isArray(p) ? p.reduce((a, b) => a + b, 0) : p;
      expect(total).toBeLessThan(400);
    });
  });

  it('doubles behave', () => {
    const rec = new RecordingHaptics();
    rec.trigger('success');
    expect(rec.triggered).toEqual(['success']);
    expect(() => new NoopHaptics().trigger('light')).not.toThrow();
  });
});

describe('SynthAudio background music', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('schedules a bar of bass and arpeggio, through its own volume control', () => {
    const { context, scheduled } = fakeContext();
    const audio = new SynthAudio(() => context);
    audio.startMusic();
    // Two held bass notes and eight arpeggio notes.
    expect(scheduled.length).toBeGreaterThanOrEqual(10);
    // Music goes through a master gain, so stopping can fade it out.
    expect(scheduled.every(n => !n.connectedToDestination)).toBe(true);
    audio.stopMusic();
  });

  it('keeps scheduling ahead while it plays, and stops when asked', () => {
    const { context, scheduled } = fakeContext();
    let now = 10;
    Object.defineProperty(context, 'currentTime', { get: () => now });
    const audio = new SynthAudio(() => context);
    audio.startMusic();
    const first = scheduled.length;
    now += 2.4;
    jest.advanceTimersByTime(600);
    expect(scheduled.length).toBeGreaterThan(first);
    audio.stopMusic();
    const stopped = scheduled.length;
    now += 5;
    jest.advanceTimersByTime(2000);
    expect(scheduled.length).toBe(stopped);
  });

  it('starts only once however often it is asked', () => {
    const { context, scheduled } = fakeContext();
    const audio = new SynthAudio(() => context);
    audio.startMusic();
    const once = scheduled.length;
    audio.startMusic();
    expect(scheduled.length).toBe(once);
    audio.stopMusic();
  });
});
