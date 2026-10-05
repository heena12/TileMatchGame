import React from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

/** Whole intro length (ms) and the time one group takes to fall. */
export const TILE_INTRO_MS = 1300;
const GROUP_DROP_MS = 520;

/**
 * A band of tiles (one layer, a couple of rows) that drops in together at its
 * own moment of the shared `progress` (0..1 over TILE_INTRO_MS). Animating a
 * handful of bands instead of every tile keeps opening a 150-tile level cheap.
 * At 1, and for tiles added later (Undo), it sits in place.
 */
export function IntroGroup({
  progress,
  delayMs,
  layer,
  children,
}: {
  progress: { value: number };
  delayMs: number;
  layer: number;
  children: React.ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const step = Math.min(
      Math.max((progress.value * TILE_INTRO_MS - delayMs) / GROUP_DROP_MS, 0),
      1,
    );
    const eased = 1 - Math.pow(1 - step, 3);
    // A small overshoot just before landing gives the drop its bounce.
    const bounce =
      step > 0.6 && step < 1
        ? Math.sin(((step - 0.6) / 0.4) * Math.PI) * 0.03
        : 0;
    return {
      opacity: Math.min(1, step * 4),
      transform: [
        { translateY: -220 * (1 - eased) },
        { scale: 0.9 + 0.1 * eased + bounce },
      ],
    };
  }, [progress, delayMs]);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.fill, { zIndex: layer }, style]}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ fill: { ...StyleSheet.absoluteFill } });
