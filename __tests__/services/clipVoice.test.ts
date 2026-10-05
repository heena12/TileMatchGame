import { ClipVoiceAudio, clipKey } from '@services/audio/ClipVoiceAudio';
import type { VoiceContextLike } from '@services/audio/ClipVoiceAudio';
import { VOICE_CLIPS } from '@services/audio/voiceClips';
import { RecordingAudio } from '@services/audio/RecordingAudio';
import { praiseFor } from '@state/praise';

describe('voice clips', () => {
  it('has a clip for every praise line and the win line', () => {
    const lines = ['Brilliant!'];
    for (let level = 0; level < 5; level++) {
      for (let seq = 0; seq < 10; seq++) {
        lines.push(praiseFor(level, seq).spoken);
      }
    }
    for (const line of new Set(lines)) {
      expect(VOICE_CLIPS[clipKey(line)]).toBeDefined();
    }
  });

  it('maps text to keys, ignoring case, quotes and punctuation', () => {
    expect(clipKey("That's Amazing!")).toBe('thats-amazing');
    expect(clipKey('Superb Control')).toBe('superb-control');
  });

  it('decodes a clip once and plays it each time', async () => {
    const started: unknown[] = [];
    const stopped: number[] = [];
    const decode = jest.fn(async () => ({ decoded: true }));
    const context = {
      currentTime: 0,
      destination: {},
      decodeAudioData: decode,
      createBufferSource: () => ({
        buffer: null as unknown,
        connect: () => undefined,
        start() {
          started.push(this.buffer);
        },
        stop: (when?: number) => {
          stopped.push(when ?? 0);
        },
      }),
      createGain: () => ({
        gain: {
          value: 1,
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
        },
        connect: () => undefined,
      }),
      createOscillator: jest.fn(),
    } as unknown as VoiceContextLike;
    const voice = new ClipVoiceAudio(new RecordingAudio(), () => context);
    voice.speak('Brilliant!');
    voice.speak('Brilliant!');
    voice.speak('no such clip');
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(decode).toHaveBeenCalledTimes(1);
    expect(started).toHaveLength(2);
    // The second line cut the first one off rather than playing over it.
    expect(stopped).toHaveLength(1);
  });
});
