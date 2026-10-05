import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { PUZZLE_PIECES } from '@state/puzzle';
import { Coin } from '@ui/components/Coin';
import { textOutline } from '@ui/theme/tokens';

/** How long the reveal of a new piece takes (ms). */
const REVEAL_MS = 700;
/** Space between the pieces (the cream dividers). */
const GRID_GAP = 3;

/**
 * One quarter of the painted picture (the Eiffel Tower over the river), drawn
 * with plain views. The tower stands in the right-hand column, so the top-right
 * and bottom-right pieces line up when both are revealed.
 */
function ScenePiece({ index, size }: { index: number; size: number }) {
  const s = size;
  if (index === 0) {
    return (
      <View style={[styles.fillSky, styles.skyTop]}>
        <View style={[styles.skyLow, { top: s * 0.45 }]} />
        <View
          style={[
            styles.cloud,
            { width: s * 0.74, height: s * 0.26, left: s * 0.04, top: s * 0.6 },
          ]}
        />
        <View
          style={[
            styles.cloud,
            { width: s * 0.42, height: s * 0.2, left: s * 0.36, top: s * 0.52 },
          ]}
        />
      </View>
    );
  }
  if (index === 1) {
    return (
      <View style={[styles.fillSky, styles.skyTop]}>
        <View style={[styles.skyLow, { top: s * 0.5 }]} />
        <View
          style={[
            styles.cloud,
            { width: s * 0.4, height: s * 0.18, left: s * 0.02, top: s * 0.62 },
          ]}
        />
        <View
          style={[
            styles.spire,
            { left: s * 0.585, top: s * 0.08, height: s * 0.22 },
          ]}
        />
        <View
          style={[
            styles.towerTop,
            {
              left: s * 0.4,
              top: s * 0.28,
              borderLeftWidth: s * 0.1,
              borderRightWidth: s * 0.1,
              borderBottomWidth: s * 0.72,
            },
          ]}
        />
      </View>
    );
  }
  if (index === 2) {
    return (
      <View style={[styles.fillSky, styles.skyLowPiece]}>
        <View
          style={[
            styles.cloud,
            { width: s * 0.5, height: s * 0.18, left: s * 0.08, top: s * 0.08 },
          ]}
        />
        <View
          style={[
            styles.treeBack,
            {
              width: s * 0.62,
              height: s * 0.42,
              left: s * 0.06,
              top: s * 0.36,
            },
          ]}
        />
        <View
          style={[
            styles.blossom,
            { width: s * 0.4, height: s * 0.4, left: s * 0.12, top: s * 0.34 },
          ]}
        />
        <View
          style={[
            styles.blossom,
            {
              width: s * 0.32,
              height: s * 0.32,
              left: s * 0.46,
              top: s * 0.44,
            },
          ]}
        />
        <View style={[styles.water, { height: s * 0.3, top: s * 0.7 }]} />
      </View>
    );
  }
  return (
    <View style={[styles.fillSky, styles.skyLowPiece]}>
      <View
        style={[
          styles.platform,
          { left: s * 0.22, width: s * 0.56, height: s * 0.07 },
        ]}
      />
      <View
        style={[
          styles.leg,
          { left: s * 0.24, width: s * 0.11, height: s * 0.74, top: s * 0.05 },
        ]}
      />
      <View
        style={[
          styles.leg,
          { left: s * 0.65, width: s * 0.11, height: s * 0.74, top: s * 0.05 },
        ]}
      />
      <View style={[styles.water, { height: s * 0.3, top: s * 0.7 }]} />
      <View
        style={[
          styles.ripple,
          { width: s * 0.5, height: s * 0.04, left: s * 0.2, top: s * 0.8 },
        ]}
      />
      <View
        style={[
          styles.ripple,
          { width: s * 0.3, height: s * 0.04, left: s * 0.5, top: s * 0.9 },
        ]}
      />
    </View>
  );
}

/** A little stack of gold coins with the prize amount, for the last slot. */
function CoinPrize({ size }: { size: number }) {
  const coin = size * 0.34;
  const bob = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) {
      bob.value = withRepeat(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }
  }, [bob, reduced]);
  const style = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: -2.5 * bob.value },
        { scale: 1 + 0.04 * bob.value },
      ],
    }),
    [bob],
  );
  return (
    <Animated.View style={[styles.prize, style]}>
      <View style={[styles.stack, { width: coin * 1.7, height: coin * 1.5 }]}>
        <View style={[styles.stackCoin, { top: coin * 0.6 }]}>
          <Coin size={coin} />
        </View>
        <View style={[styles.stackCoin, { left: coin * 0.7, top: coin * 0.7 }]}>
          <Coin size={coin} />
        </View>
        <View style={[styles.stackCoin, { left: coin * 0.35 }]}>
          <Coin size={coin} />
        </View>
      </View>
      <Text style={[styles.prizeText, { fontSize: size * 0.2 }]}>x150</Text>
    </Animated.View>
  );
}

/** White flash, a pop and a ring of sparkles for a piece that was just earned. */
function Reveal({
  size,
  playKey,
  delayMs,
}: {
  size: number;
  playKey: number;
  delayMs: number;
}) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (playKey > 0) {
      p.value = 0;
      p.value = withDelay(delayMs, withTiming(1, { duration: REVEAL_MS }));
    }
  }, [p, playKey, delayMs]);
  const flash = useAnimatedStyle(() => {
    const v = p.value;
    return {
      opacity:
        v === 0 || v === 1 ? 0 : v < 0.25 ? v / 0.25 : 1 - (v - 0.25) / 0.75,
    };
  }, [p]);
  return (
    <>
      <Animated.View pointerEvents="none" style={[styles.flash, flash]} />
      {Array.from({ length: 8 }, (_, i) => (
        <Sparkle key={i} index={i} size={size} progress={p} />
      ))}
    </>
  );
}

function Sparkle({
  index,
  size,
  progress,
}: {
  index: number;
  size: number;
  progress: { value: number };
}) {
  const angle = (index / 8) * Math.PI * 2;
  const style = useAnimatedStyle(() => {
    const v = progress.value;
    const reach = size * 0.62 * v;
    return {
      opacity: v === 0 || v === 1 ? 0 : 1 - v,
      transform: [
        { translateX: Math.cos(angle) * reach },
        { translateY: Math.sin(angle) * reach },
        { scale: 0.6 + 0.6 * Math.sin(v * Math.PI) },
        { rotate: `${v * 120}deg` },
      ],
    };
  }, [angle, size, progress]);
  return (
    <Animated.Text pointerEvents="none" style={[styles.sparkle, style]}>
      ✦
    </Animated.Text>
  );
}

/**
 * The picture box from the reference game. A beveled blue frame with a plaque
 * ("2/4"), a cream border round a 2x2 grid; earned pieces show the painted
 * picture, the others are numbered slots, and the last one holds the coin
 * prize. `playKey` above 0 plays the reveal on the newest piece (a flash and
 * sparkles), and a complete picture glows.
 */
export function PuzzleFrame({
  revealed,
  pieceSize = 84,
  playKey = 0,
  revealDelayMs = 0,
}: {
  revealed: number;
  pieceSize?: number;
  playKey?: number;
  revealDelayMs?: number;
}) {
  const reduced = useReducedMotion();
  const newest = revealed - 1;
  const complete = revealed >= PUZZLE_PIECES;

  // A piece that was just earned stays a numbered slot until the flash is at
  // its brightest, then turns into the picture.
  const playing = playKey > 0 && !reduced;
  const [newShown, setNewShown] = useState(!playing);
  useEffect(() => {
    if (!playing) {
      setNewShown(true);
      return undefined;
    }
    setNewShown(false);
    const id = setTimeout(
      () => setNewShown(true),
      revealDelayMs + REVEAL_MS * 0.22,
    );
    return () => clearTimeout(id);
  }, [playing, playKey, revealDelayMs]);
  const glow = useSharedValue(0);
  useEffect(() => {
    if (playKey > 0 && complete && !reduced) {
      glow.value = withDelay(
        revealDelayMs + 250,
        withRepeat(withTiming(1, { duration: 450 }), 4, true),
      );
    }
  }, [glow, playKey, complete, reduced, revealDelayMs]);
  const glowStyle = useAnimatedStyle(
    () => ({ shadowOpacity: 0.35 + 0.65 * glow.value }),
    [glow],
  );

  return (
    <Animated.View
      testID="puzzle-progress"
      style={[styles.frame, complete && styles.frameGlow, glowStyle]}
    >
      <View style={styles.plaque}>
        <View style={styles.rivet} />
        <Text style={styles.plaqueText}>{`${revealed}/${PUZZLE_PIECES}`}</Text>
        <View style={styles.rivet} />
      </View>
      <View style={styles.cream}>
        <View style={[styles.grid, { width: pieceSize * 2 + GRID_GAP }]}>
          {Array.from({ length: PUZZLE_PIECES }, (_, i) => {
            const isNew = i === newest && playKey > 0;
            const shown = i < revealed && !(isNew && !newShown);
            return (
              <View
                key={i}
                testID={shown ? `puzzle-piece-${i}` : `puzzle-empty-${i}`}
                style={[styles.slot, { width: pieceSize, height: pieceSize }]}
              >
                {shown ? (
                  <ScenePiece index={i} size={pieceSize} />
                ) : i === PUZZLE_PIECES - 1 ? (
                  <CoinPrize size={pieceSize} />
                ) : (
                  <Text style={[styles.number, { fontSize: pieceSize * 0.32 }]}>
                    {String(i + 1)}
                  </Text>
                )}
                {isNew ? (
                  <Reveal
                    size={pieceSize}
                    playKey={playKey}
                    delayMs={revealDelayMs}
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    alignItems: 'center',
    padding: 7,
    paddingTop: 12,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#2B5497',
    borderTopColor: '#5E91D6',
    backgroundColor: '#3F74BD',
    shadowColor: '#14305F',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
  },
  frameGlow: { shadowColor: '#FFD54F', shadowRadius: 18 },
  plaque: {
    position: 'absolute',
    top: -14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#3568AE',
    borderWidth: 2,
    borderColor: '#2B5497',
    borderTopColor: '#6FA2E6',
    zIndex: 3,
  },
  rivet: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#9EC4F2',
  },
  plaqueText: { fontSize: 13, fontWeight: '900', color: '#F4EBDC' },
  cream: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#F4EBDC',
    borderWidth: 1,
    borderColor: '#D8CBB4',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    justifyContent: 'center',
  },
  slot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
    backgroundColor: '#76A4EF',
  },
  number: { fontWeight: '900', color: '#3A63AF' },
  prize: { alignItems: 'center', justifyContent: 'center' },
  stack: { position: 'relative' },
  stackCoin: { position: 'absolute', left: 0, top: 0 },
  prizeText: {
    fontWeight: '900',
    color: '#FFE45C',
    ...textOutline,
  },
  flash: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#FFFFFF',
  },
  sparkle: {
    position: 'absolute',
    fontSize: 22,
    color: '#FFD54F',
    textShadowColor: '#B5500F',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  // Painted picture pieces.
  fillSky: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  skyTop: { backgroundColor: '#3FA2F2' },
  skyLowPiece: { backgroundColor: '#8ED0FA' },
  skyLow: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#78C2F8',
  },
  cloud: { position: 'absolute', borderRadius: 40, backgroundColor: '#FFFFFF' },
  spire: {
    position: 'absolute',
    width: 3,
    backgroundColor: '#6B5B50',
  },
  towerTop: {
    position: 'absolute',
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#7D6A5C',
  },
  platform: { position: 'absolute', top: 0, backgroundColor: '#7D6A5C' },
  leg: { position: 'absolute', backgroundColor: '#6B5B50' },
  towerLeg: {
    position: 'absolute',
    top: 0,
    width: 0,
    height: 0,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#6B5B50',
  },
  treeBack: {
    position: 'absolute',
    borderRadius: 30,
    backgroundColor: '#5DAA4B',
  },
  blossom: {
    position: 'absolute',
    borderRadius: 30,
    backgroundColor: '#F7A8CF',
  },
  water: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: '#2F9BE3',
  },
  ripple: {
    position: 'absolute',
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
});
