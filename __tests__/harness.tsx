import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { ILevelSource, LevelData } from '@engine';
import App from '@app/App';
import { createContainer } from '@app/di/container';
import type { Container, ContainerOptions } from '@app/di/container';
import { RecordingAnalytics } from '@services/analytics/RecordingAnalytics';
import { RecordingAudio } from '@services/audio/RecordingAudio';
import { RecordingHaptics } from '@services/haptics/RecordingHaptics';
import { InMemoryStorage } from '@services/storage/InMemoryStorage';
import { APP_CONFIG } from '@config/constants';
import { REVIVE_COUNTDOWN_S } from '@config/revive';
import { ANIMATION } from '@ui/animation/timings';
import { fixedSource, flush, tinyLevel } from './testUtils';

export type Renderer = ReactTestRenderer.ReactTestRenderer;
export type Instance = ReactTestRenderer.ReactTestInstance;

export const act = ReactTestRenderer.act;

export interface Harness {
  r: Renderer;
  container: Container;
  analytics: RecordingAnalytics;
  audio: RecordingAudio;
  haptics: RecordingHaptics;
  storage: InMemoryStorage;
}

/** Renders the whole app on in-memory fakes. Tests using this need fake timers. */
export async function launch(
  levelSource: ILevelSource<LevelData> = fixedSource(tinyLevel),
  storage = new InMemoryStorage(),
  extra: ContainerOptions = {},
): Promise<Harness> {
  const analytics = new RecordingAnalytics();
  const audio = new RecordingAudio();
  const haptics = new RecordingHaptics();
  const container = createContainer({
    storage,
    analytics,
    levelSource,
    audio,
    haptics,
    ...extra,
  });
  let r!: Renderer;
  await act(async () => {
    r = ReactTestRenderer.create(<App container={container} />);
  });
  return { r, container, analytics, audio, haptics, storage };
}

export const dump = (r: Renderer) => JSON.stringify(r.toJSON());

export const byId = (r: Renderer, id: string): Instance | undefined =>
  r.root.findAll(
    n => n.props.testID === id && typeof n.props.onPress === 'function',
  )[0];

/** Every rendered (host) node whose testID starts with `prefix`. */
export const hostByPrefix = (r: Renderer, prefix: string) =>
  r.root.findAll(
    n =>
      typeof n.type === 'string' &&
      typeof n.props.testID === 'string' &&
      n.props.testID.startsWith(prefix),
  );

export async function press(r: Renderer, id: string) {
  const target = byId(r, id);
  if (!target) {
    throw new Error(`Nothing pressable with testID "${id}"`);
  }
  await act(async () => {
    target.props.onPress();
    await flush();
  });
}

export async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

export async function toHome(_h: Harness) {
  await advance(APP_CONFIG.splashDurationMs + 200);
}

/**
 * Taps tiles until the tray fills, then lets the revive countdown run out, so
 * the game is counted as lost and the Result screen opens.
 */
export async function loseTiles(h: Harness, ids: number[]) {
  for (const id of ids) {
    await press(h.r, `tile-${id}`);
  }
  await advance(REVIVE_COUNTDOWN_S * 1000 + 600);
}

/** Taps each tile, then waits out the pause before the Result screen. */
export async function playTiles(h: Harness, ids: number[]) {
  for (const id of ids) {
    await press(h.r, `tile-${id}`);
  }
  await advance(ANIMATION.endDelayMs + 100);
}
