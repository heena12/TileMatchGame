import type { IAudio } from './IAudio';
import { NoopAudio } from './NoopAudio';
import { ClipVoiceAudio } from './ClipVoiceAudio';
import type { VoiceContextLike } from './ClipVoiceAudio';
import { SynthAudio } from './SynthAudio';
import type { AudioContextLike } from './SynthAudio';

/**
 * Android / iOS: react-native-audio-api provides a Web Audio compatible
 * context. The web build swaps this file for createAudio.web.ts. If the native
 * module is missing (tests, unlinked build) we fall back to silence.
 */
export function createAudio(): IAudio {
  try {
    const { AudioContext } = require('react-native-audio-api');
    return new ClipVoiceAudio(
      new SynthAudio(() => new AudioContext() as AudioContextLike),
      () => new AudioContext() as VoiceContextLike,
    );
  } catch {
    return new NoopAudio();
  }
}
