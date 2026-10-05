import React, { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type Kind = 'bird' | 'sway';

/**
 * Gentle looping motion for a decoration, like the bird on the Home logo.
 * - `bird`: a small hop with a head tilt and a squash, about every 1.2 s.
 * - `sway`: a slow rock of a few tenths of a degree.
 * Reduced motion leaves the child still.
 */
export function IdleMotion({
  kind,
  children,
}: {
  kind: Kind;
  children: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  const phase = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      phase.value = 0;
      return;
    }
    phase.value = withRepeat(
      withTiming(1, {
        duration: kind === 'bird' ? 600 : 1800,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [phase, reduced, kind]);

  const style = useAnimatedStyle(() => {
    const p = phase.value;
    if (kind === 'bird') {
      return {
        transform: [
          { translateY: -4 * p },
          { rotate: `${(p - 0.5) * 12}deg` },
          { scaleY: 1 - 0.05 * (1 - p) },
        ],
      };
    }
    return { transform: [{ rotate: `${(p - 0.5) * 1.6}deg` }] };
  }, [phase, kind]);

  return <Animated.View style={style}>{children}</Animated.View>;
}
