import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import type { Rect } from '@ui/game/trayMetrics';
import { ANIMATION } from './timings';

/** Strips of paper thrown out of the matched slots; the reference game's signature. */
const SHARDS = 26;
/** Colourful confetti, only for combos. */
const PIECES = 10;

/** Runs 0 -> 1 over `duration`, starting once the matched tile has landed. */
function useLandedProgress(duration: number) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(ANIMATION.flightMs, withTiming(1, { duration }));
  }, [progress, duration]);
  return progress;
}

/** A gold crown badge that pops above the middle matched tile on a combo. */
function CrownPop({ rect }: { rect: Rect }) {
  const progress = useLandedProgress(ANIMATION.celebrateMs);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const pop = p < 0.2 ? p / 0.2 : 1;
    return {
      opacity: p === 0 ? 0 : p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3,
      transform: [
        { translateY: -18 - p * 16 },
        { scale: pop * 1.25 - Math.max(0, pop - 0.2) * 0.25 },
      ],
    };
  }, [progress]);
  return (
    <Animated.View
      testID="match-star"
      style={[
        styles.crown,
        { left: rect.left + rect.width / 2 - 14, top: rect.top - 4 },
        style,
      ]}
    >
      <Text style={styles.crownGlyph}>★</Text>
    </Animated.View>
  );
}

/**
 * One white strip of paper. They leave the matched slots mostly down and to
 * the left, tumbling, and fall with gravity, like the reference game.
 */
function Shard({ rect, index }: { rect: Rect; index: number }) {
  const progress = useLandedProgress(ANIMATION.shardsMs);
  // 95..165 degrees: from straight down round to straight left.
  const angle = ((95 + ((index * 37) % 70)) * Math.PI) / 180;
  const speed = 90 + ((index * 53) % 220);
  const spin = 200 + ((index * 71) % 360);
  const long = 14 + ((index * 13) % 12);
  const wide = 5 + ((index * 7) % 4);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : p < 0.55 ? 0.95 : 0.95 * (1 - (p - 0.55) / 0.45),
      transform: [
        { translateX: Math.cos(angle) * speed * p },
        { translateY: Math.sin(angle) * speed * p + 230 * p * p },
        { rotate: `${spin * p}deg` },
      ],
    };
  }, [angle, speed, spin, progress]);
  return (
    <Animated.View
      style={[
        styles.shard,
        {
          left: rect.left + rect.width / 2 - wide / 2,
          top: rect.top + rect.height / 2 - long / 2,
          width: wide,
          height: long,
        },
        style,
      ]}
    />
  );
}

/** One strip of colourful confetti, thrown out and falling (combos only). */
function Piece({ rect, index }: { rect: Rect; index: number }) {
  const progress = useLandedProgress(ANIMATION.celebrateMs);
  const angle = (index / PIECES) * Math.PI * 2 + index * 0.3;
  const speed = 46 + ((index * 29) % 50);
  const spin = 180 + ((index * 67) % 300);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : 1 - p * p,
      transform: [
        { translateX: Math.cos(angle) * speed * p },
        { translateY: Math.sin(angle) * speed * p + 110 * p * p },
        { rotate: `${spin * p}deg` },
      ],
    };
  }, [angle, speed, spin, progress]);
  return (
    <Animated.View
      style={[
        styles.piece,
        {
          left: rect.left + rect.width / 2 - 3,
          top: rect.top + rect.height / 2 - 6,
        },
        PIECE_COLORS[index % PIECE_COLORS.length],
        style,
      ]}
    />
  );
}

/** A soft golden glow over the matched slots as the match lands. */
function SlotGlow({ first, last }: { first: Rect; last: Rect }) {
  const progress = useLandedProgress(ANIMATION.celebrateMs * 0.6);
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p === 0 ? 0 : p < 0.25 ? p / 0.25 : 1 - (p - 0.25) / 0.75,
    };
  }, [progress]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        {
          left: first.left - 5,
          top: first.top - 5,
          width: last.left + last.width - first.left + 10,
          height: first.height + 10,
        },
        style,
      ]}
    />
  );
}

/** Everything that celebrates one match, centred on the matched tray slots. */
export function MatchCelebration({
  rects,
  crown,
}: {
  rects: readonly Rect[];
  /** A combo: add the crown and confetti. */
  crown: boolean;
}) {
  const sorted = [...rects].sort((a, b) => a.left - b.left);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const middle = sorted[Math.floor(sorted.length / 2)];
  if (!first || !last || !middle) {
    return null;
  }
  return (
    <>
      <SlotGlow first={first} last={last} />
      {Array.from({ length: SHARDS }, (_, i) => (
        <Shard key={`s${i}`} rect={middle} index={i} />
      ))}
      {crown ? <CrownPop rect={middle} /> : null}
      {crown
        ? Array.from({ length: PIECES }, (_, i) => (
            <Piece key={`p${i}`} rect={middle} index={i} />
          ))
        : null}
    </>
  );
}

const styles = StyleSheet.create({
  crown: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFC531',
    borderWidth: 2,
    borderColor: '#FFF1A8',
  },
  crownGlyph: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  shard: {
    position: 'absolute',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
  piece: { position: 'absolute', width: 6, height: 12, borderRadius: 2 },
  red: { backgroundColor: '#FF476F' },
  yellow: { backgroundColor: '#FFD035' },
  blue: { backgroundColor: '#55C7F3' },
  green: { backgroundColor: '#77D04B' },
  purple: { backgroundColor: '#9B69EC' },
  orange: { backgroundColor: '#FF9F1C' },
  glow: {
    position: 'absolute',
    borderRadius: 12,
    backgroundColor: 'rgba(255, 213, 79, 0.5)',
    shadowColor: '#FFD54F',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 14,
    elevation: 10,
  },
});

const PIECE_COLORS = [
  styles.red,
  styles.yellow,
  styles.blue,
  styles.green,
  styles.purple,
  styles.orange,
];
