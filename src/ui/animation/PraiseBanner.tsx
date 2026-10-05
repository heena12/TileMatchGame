import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Praise, PraiseTone } from '@state/praise';
import { ANIMATION } from './timings';

const SHOW_MS = 1000;

/**
 * Text colour plus an edge in a darker shade, per tone, so each praise reads
 * on the sand background the way it does in the reference game.
 */
const TONES: Readonly<
  Record<PraiseTone, { color: string; textShadowColor: string; glow: string }>
> = {
  gold: { color: '#FFE45C', textShadowColor: '#B5500F', glow: '#FFB02E' },
  green: { color: '#9DFF63', textShadowColor: '#2E7A10', glow: '#7BE04A' },
  pink: { color: '#FF9BF0', textShadowColor: '#7A1FA0', glow: '#C86BFF' },
};

/** Offsets (px) of the dark copies that make the outline round the text. */
const OUTLINE_OFFSETS = StyleSheet.create({
  o0: { left: -2, top: 0 },
  o1: { left: 2, top: 0 },
  o2: { left: 0, top: -2 },
  o3: { left: 0, top: 3 },
  o4: { left: -1.5, top: -1.5 },
  o5: { left: 1.5, top: -1.5 },
  o6: { left: -1.5, top: 2.5 },
  o7: { left: 1.5, top: 2.5 },
});
const OFFSET_KEYS = ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7'] as const;

const TONE_STYLES = StyleSheet.create({
  gold: { color: TONES.gold.color },
  green: { color: TONES.green.color },
  pink: { color: TONES.pink.color },
});
const EDGE_STYLES = StyleSheet.create({
  gold: { color: TONES.gold.textShadowColor },
  green: { color: TONES.green.textShadowColor },
  pink: { color: TONES.pink.textShadowColor },
});

/** Bold text with a solid dark outline, drawn as offset copies behind it. */
function OutlinedText({
  text,
  tone,
  big = false,
}: {
  text: string;
  tone: PraiseTone;
  big?: boolean;
}) {
  const size = big ? styles.big : styles.text;
  return (
    <View>
      {OFFSET_KEYS.map(key => (
        <Text
          key={key}
          accessible={false}
          numberOfLines={1}
          style={[size, EDGE_STYLES[tone], styles.edge, OUTLINE_OFFSETS[key]]}
        >
          {text}
        </Text>
      ))}
      <Text numberOfLines={1} style={[size, TONE_STYLES[tone]]}>
        {text}
      </Text>
    </View>
  );
}

/**
 * "Superb Control", "You're Great!", "Unbelievable X3": pops in just under
 * the tray once the matched tile has landed, then fades. Mount with a new key
 * for each match.
 */
export function PraiseBanner({ praise }: { praise: Praise }) {
  const progress = useSharedValue(0);
  // Nothing is drawn until the matched tile has landed in the tray.
  const [phase, setPhase] = useState<'waiting' | 'showing' | 'done'>('waiting');

  useEffect(() => {
    const show = setTimeout(() => {
      setPhase('showing');
      progress.value = withTiming(1, { duration: SHOW_MS });
    }, ANIMATION.flightMs);
    const hide = setTimeout(
      () => setPhase('done'),
      ANIMATION.flightMs + SHOW_MS,
    );
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [progress]);

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // A quick pop to 1.12x, settle at 1, then fade over the last quarter.
    const scale =
      p < 0.12
        ? 0.6 + (p / 0.12) * 0.52
        : 1.12 - Math.min((p - 0.12) * 0.9, 0.12);
    return {
      opacity: p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25,
      transform: [{ scale }, { translateY: -p * 8 }],
    };
  }, [progress]);

  if (phase !== 'showing') {
    return null;
  }
  return (
    <View pointerEvents="none" style={styles.wrap} testID="praise-banner">
      <Animated.View style={[styles.row, style]}>
        <OutlinedText text={praise.text} tone={praise.tone} />
        {praise.multiplier > 0 ? (
          <OutlinedText text={` X${praise.multiplier}`} tone="gold" big />
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    paddingTop: 112,
  },
  row: { flexDirection: 'row', alignItems: 'baseline' },
  text: { fontSize: 25, fontWeight: '900', letterSpacing: 0.3 },
  big: { fontSize: 31, fontWeight: '900', letterSpacing: 0.3 },
  edge: { position: 'absolute' },
});
