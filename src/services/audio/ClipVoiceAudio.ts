import type { IAudio, SoundCue } from './IAudio';
import type { AudioContextLike, GainLike } from './SynthAudio';
import { VOICE_CLIPS } from './voiceClips';

interface BufferSourceLike {
  buffer: unknown;
  connect(destination: unknown): unknown;
  start(when?: number): void;
  stop(when?: number): void;
}

export interface VoiceContextLike extends AudioContextLike {
  decodeAudioData(data: ArrayBuffer): Promise<unknown>;
  createBufferSource(): BufferSourceLike;
}

/** "That's Amazing!" -> "thats-amazing", matching the keys of VOICE_CLIPS. */
export function clipKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Lets the matched tile reach the tray before the praise is heard. */
const VOICE_DELAY_S = 0.26;
/** How quickly an interrupted line fades out (s). */
const VOICE_FADE_S = 0.06;

function toArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Adds a spoken voice to any IAudio by playing the bundled praise clips. A clip
 * is decoded once, on first use. Lines are short and arrive seconds apart,
 * so a new one does not cut off the previous.
 */
export class ClipVoiceAudio implements IAudio {
  private context: VoiceContextLike | null = null;
  private readonly buffers = new Map<string, Promise<unknown>>();
  private broken = false;
  private current: { source: BufferSourceLike; gain: GainLike } | null = null;

  constructor(
    private readonly inner: IAudio,
    private readonly createContext: () => VoiceContextLike,
  ) {}

  startMusic(): void {
    this.inner.startMusic?.();
  }

  stopMusic(): void {
    this.inner.stopMusic?.();
  }

  /** Creates both audio engines and decodes the voice clips ahead of time. */
  prime(): void {
    this.inner.prime?.();
    if (this.broken) {
      return;
    }
    try {
      const context = this.context ?? (this.context = this.createContext());
      for (const [key, clip] of Object.entries(VOICE_CLIPS)) {
        if (!this.buffers.has(key)) {
          this.buffers.set(key, context.decodeAudioData(toArrayBuffer(clip)));
        }
      }
    } catch {
      this.broken = true;
    }
  }

  play(cue: SoundCue): void {
    this.inner.play(cue);
  }

  private fadeOutCurrent(now: number): void {
    const previous = this.current;
    this.current = null;
    if (!previous) {
      return;
    }
    try {
      previous.gain.gain.setValueAtTime(1, now);
      previous.gain.gain.linearRampToValueAtTime(0, now + VOICE_FADE_S);
      previous.source.stop(now + VOICE_FADE_S + 0.02);
    } catch {
      // Already finished: nothing to cut off.
    }
  }

  speak(text: string): void {
    const key = clipKey(text);
    const clip = VOICE_CLIPS[key];
    if (this.broken || clip === undefined) {
      return;
    }
    try {
      const context = this.context ?? (this.context = this.createContext());
      if (context.state === 'suspended') {
        context.resume?.();
      }
      let buffer = this.buffers.get(key);
      if (!buffer) {
        buffer = context.decodeAudioData(toArrayBuffer(clip));
        this.buffers.set(key, buffer);
      }
      buffer
        .then(decoded => {
          // A new line fades the previous one out instead of talking over it.
          this.fadeOutCurrent(context.currentTime);
          const source = context.createBufferSource();
          const gain = context.createGain();
          source.buffer = decoded;
          source.connect(gain);
          gain.connect(context.destination);
          source.start(context.currentTime + VOICE_DELAY_S);
          this.current = { source, gain };
        })
        .catch(() => {
          this.broken = true;
        });
    } catch {
      this.broken = true;
    }
  }
}
