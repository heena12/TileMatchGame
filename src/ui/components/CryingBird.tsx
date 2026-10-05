import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

/** Size the chick is drawn at before scaling, and room above it for the tuft. */
const BASE_W = 300;
const BASE_H = 236;
const TUFT_ROOM = 8;

/** A waterfall of tears that runs from the eye down into the puddle, again and again. */
function Tears() {
  const reduced = useReducedMotion();
  const flow = useSharedValue(0);
  useEffect(() => {
    if (!reduced) {
      flow.value = withRepeat(
        withTiming(1, { duration: 1000, easing: Easing.in(Easing.quad) }),
        -1,
        false,
      );
    }
  }, [flow, reduced]);
  const wide = useAnimatedStyle(
    () => ({
      opacity: 0.9 - 0.25 * flow.value,
      transform: [{ scaleY: 0.82 + 0.18 * flow.value }],
    }),
    [flow],
  );
  const thin = useAnimatedStyle(
    () => ({
      opacity: 0.8 - 0.3 * ((flow.value + 0.5) % 1),
      transform: [{ scaleY: 0.85 + 0.15 * ((flow.value + 0.5) % 1) }],
    }),
    [flow],
  );
  return (
    <>
      <Animated.View style={[styles.tearWide, wide]}>
        <View style={styles.tearShine} />
        <View style={styles.tearShineSmall} />
      </Animated.View>
      <Animated.View style={[styles.tearThin, thin]} />
    </>
  );
}

/** A drop that jumps out of the puddle where the tears land. */
function Splash({ left, delayed }: { left: number; delayed: boolean }) {
  const reduced = useReducedMotion();
  const hop = useSharedValue(delayed ? 0.5 : 0);
  useEffect(() => {
    if (!reduced) {
      hop.value = withRepeat(
        withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }),
        -1,
        false,
      );
    }
  }, [hop, reduced]);
  const style = useAnimatedStyle(() => {
    const h = hop.value;
    return {
      opacity: 1 - h,
      transform: [
        { translateY: -30 * Math.sin(h * Math.PI) },
        { scale: 1 - 0.4 * h },
      ],
    };
  }, [hop]);
  return <Animated.View style={[styles.splash, { left }, style]} />;
}

/**
 * The chick crying in a puddle, drawn with plain views so it needs no
 * artwork. It sits side-on like the reference: a round body, a big head tipped
 * back with the beak wide open, squeezed-shut eyes, a raised wing, and a wide
 * waterfall of tears running into a puddle that splashes.
 */
export function CryingBird({ scale = 1 }: { scale?: number }) {
  const reduced = useReducedMotion();
  const sob = useSharedValue(0);
  useEffect(() => {
    if (!reduced) {
      sob.value = withRepeat(
        withTiming(1, { duration: 360, easing: Easing.inOut(Easing.quad) }),
        -1,
        true,
      );
    }
  }, [sob, reduced]);
  const chick = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: -2.5 * sob.value },
        { rotate: `${-1.2 * sob.value}deg` },
      ],
    }),
    [sob],
  );

  return (
    <View
      testID="crying-bird"
      style={[
        styles.outer,
        { width: BASE_W * scale, height: (BASE_H + TUFT_ROOM) * scale },
      ]}
    >
      <View
        style={[
          styles.canvas,
          {
            left: (BASE_W * scale - BASE_W) / 2,
            top: (BASE_H * scale - BASE_H) / 2 + TUFT_ROOM * scale,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={styles.puddle} />
        <View style={styles.puddleInner} />
        <View style={styles.ripple} />
        <View style={styles.puddleShine} />

        <Animated.View style={[styles.canvas, chick]}>
          <View style={styles.tail} />
          <View style={styles.body} />
          <View style={styles.belly} />
          <View style={styles.wing} />
          <View style={styles.wingTip} />
          <View style={[styles.foot, styles.footBack]} />
          <View style={[styles.foot, styles.footFront]} />
          <View style={styles.head} />
          <View style={styles.headLight} />
          <View style={[styles.tuft, styles.tuftA]} />
          <View style={[styles.tuft, styles.tuftB]} />
          <View style={[styles.tuft, styles.tuftC]} />
          <View style={styles.cheek} />
          <View style={styles.brow} />
          <View style={styles.eye} />
          <View style={styles.beakUpper} />
          <View style={styles.mouth} />
          <View style={styles.tongue} />
          <View style={styles.beakLower} />
        </Animated.View>

        <Tears />
        <Splash left={20} delayed={false} />
        <Splash left={236} delayed />
        <Splash left={62} delayed />
      </View>
    </View>
  );
}

const YELLOW = '#FFD54A';
const YELLOW_EDGE = '#F2B02A';
const ORANGE = '#F7731F';

const styles = StyleSheet.create({
  outer: { alignItems: 'center' },
  canvas: { position: 'absolute', width: BASE_W, height: BASE_H },
  puddle: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: 300,
    height: 50,
    borderRadius: 150,
    backgroundColor: 'rgba(104, 176, 238, 0.92)',
  },
  puddleInner: {
    position: 'absolute',
    left: 22,
    bottom: 9,
    width: 256,
    height: 32,
    borderRadius: 130,
    backgroundColor: 'rgba(150, 208, 250, 0.9)',
  },
  ripple: {
    position: 'absolute',
    left: 6,
    bottom: 14,
    width: 288,
    height: 22,
    borderRadius: 144,
    borderWidth: 2,
    borderColor: 'rgba(220, 244, 255, 0.7)',
  },
  puddleShine: {
    position: 'absolute',
    left: 70,
    bottom: 26,
    width: 80,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(235, 250, 255, 0.9)',
  },
  tail: {
    position: 'absolute',
    left: 252,
    top: 138,
    width: 48,
    height: 30,
    borderRadius: 18,
    backgroundColor: '#F6A63A',
    transform: [{ rotate: '-24deg' }],
  },
  body: {
    position: 'absolute',
    left: 92,
    top: 78,
    width: 178,
    height: 138,
    borderRadius: 89,
    backgroundColor: YELLOW,
    borderWidth: 3,
    borderColor: YELLOW_EDGE,
  },
  belly: {
    position: 'absolute',
    left: 104,
    top: 128,
    width: 112,
    height: 82,
    borderRadius: 56,
    backgroundColor: '#FFF2B0',
  },
  wing: {
    position: 'absolute',
    left: 206,
    top: 84,
    width: 84,
    height: 70,
    borderRadius: 40,
    backgroundColor: '#F6A63A',
    borderWidth: 2,
    borderColor: '#E98E1C',
    transform: [{ rotate: '34deg' }],
  },
  wingTip: {
    position: 'absolute',
    left: 252,
    top: 112,
    width: 34,
    height: 22,
    borderRadius: 12,
    backgroundColor: '#F2902A',
    transform: [{ rotate: '34deg' }],
  },
  foot: {
    position: 'absolute',
    top: 208,
    width: 38,
    height: 18,
    borderRadius: 11,
    backgroundColor: ORANGE,
  },
  footBack: { left: 168 },
  footFront: { left: 120 },
  head: {
    position: 'absolute',
    left: 44,
    top: 22,
    width: 158,
    height: 146,
    borderRadius: 79,
    backgroundColor: '#FFD960',
    borderWidth: 3,
    borderColor: YELLOW_EDGE,
  },
  headLight: {
    position: 'absolute',
    left: 82,
    top: 32,
    width: 78,
    height: 32,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  tuft: {
    position: 'absolute',
    top: 8,
    width: 20,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F7A234',
  },
  tuftA: { left: 92, transform: [{ rotate: '-30deg' }] },
  tuftB: { left: 112, top: 2, height: 42, backgroundColor: '#F28A2E' },
  tuftC: { left: 134, transform: [{ rotate: '24deg' }] },
  cheek: {
    position: 'absolute',
    left: 118,
    top: 104,
    width: 40,
    height: 24,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 140, 120, 0.5)',
  },
  brow: {
    position: 'absolute',
    left: 116,
    top: 62,
    width: 34,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#B9780F',
    transform: [{ rotate: '-18deg' }],
  },
  eye: {
    position: 'absolute',
    left: 122,
    top: 76,
    width: 36,
    height: 18,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 5,
    borderBottomWidth: 0,
    borderColor: '#6B3A0E',
  },
  beakUpper: {
    position: 'absolute',
    left: 22,
    top: 66,
    width: 60,
    height: 26,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 6,
    backgroundColor: ORANGE,
    transform: [{ rotate: '-38deg' }],
  },
  mouth: {
    position: 'absolute',
    left: 28,
    top: 76,
    width: 46,
    height: 30,
    borderRadius: 20,
    backgroundColor: '#8E2A12',
    transform: [{ rotate: '-38deg' }],
  },
  tongue: {
    position: 'absolute',
    left: 40,
    top: 92,
    width: 26,
    height: 13,
    borderRadius: 10,
    backgroundColor: '#F2707A',
    transform: [{ rotate: '-38deg' }],
  },
  beakLower: {
    position: 'absolute',
    left: 34,
    top: 100,
    width: 44,
    height: 18,
    borderRadius: 18,
    backgroundColor: ORANGE,
    transform: [{ rotate: '-18deg' }],
  },
  tearWide: {
    position: 'absolute',
    left: 52,
    top: 100,
    width: 56,
    height: 118,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    backgroundColor: 'rgba(125, 192, 252, 0.86)',
  },
  tearShine: {
    position: 'absolute',
    top: 10,
    left: 12,
    width: 9,
    height: 90,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
  },
  tearShineSmall: {
    position: 'absolute',
    top: 24,
    left: 34,
    width: 6,
    height: 60,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  tearThin: {
    position: 'absolute',
    left: 136,
    top: 112,
    width: 26,
    height: 106,
    borderRadius: 14,
    backgroundColor: 'rgba(125, 192, 252, 0.78)',
  },
  splash: {
    position: 'absolute',
    bottom: 38,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(170, 220, 255, 0.95)',
  },
});
