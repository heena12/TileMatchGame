import type { IAudio } from './IAudio';
import { NoopAudio } from './NoopAudio';
import { SynthAudio } from './SynthAudio';
import type { AudioContextLike } from './SynthAudio';
import { ClipVoiceAudio } from './ClipVoiceAudio';
import type { VoiceContextLike } from './ClipVoiceAudio';

type AudioContextConstructor = new () => AudioContextLike;

/** Web build: the browser's own AudioContext. Picked automatically over createAudio.ts. */
export function createAudio(): IAudio {
  const scope = globalThis as unknown as {
    AudioContext?: AudioContextConstructor;
    webkitAudioContext?: AudioContextConstructor;
  };
  const Context = scope.AudioContext ?? scope.webkitAudioContext;
  const sound: IAudio = Context
    ? new SynthAudio(() => new Context())
    : new NoopAudio();
  return Context
    ? new ClipVoiceAudio(sound, () => new Context() as VoiceContextLike)
    : sound;
}
