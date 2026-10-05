import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useSettings } from '@state/StoresContext';
import { TileBadge } from '@ui/components/TileBadge';
import { colors } from '@ui/theme/tokens';
import { getTileArt } from '@ui/theme/tileArt';
import type { Rect } from '@ui/game/trayMetrics';
import { MatchCelebration } from './MatchCelebration';
import { ANIMATION } from './timings';
import type {
  AnimationPlan,
  BurstPlan,
  FlashPlan,
  FlightPlan,
} from './stepModel';

const centre = (r: Rect) => ({
  x: r.left + r.width / 2,
  y: r.top + r.height / 2,
});

/** A copy of the tile that travels from the board to its tray slot. */
function FlyingTile({ plan }: { plan: FlightPlan }) {
  const colorFriendly = useSettings(s => s.colorFriendly);
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, {
      duration: ANIMATION.flightMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const { from, to } = plan;
  const dx = centre(to).x - centre(from).x;
  const dy = centre(to).y - centre(from).y;
  const endScale = Math.min(to.width, to.height) / from.width;

  // Dependency arrays are required by Reanimated when the Babel plugin is not
  // used (the web build), and harmless with it.
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    // Lifts off with a quick pop (up to 1.3x), then flies straight to the slot
    // and shrinks to its size: no arc and no spin, like the reference game.
    const pop = 0.3 * Math.sin(Math.min(p / 0.3, 1) * (Math.PI / 2)) * (1 - p);
    return {
      transform: [
        { translateX: dx * p },
        { translateY: dy * p },
        { scale: 1 + (endScale - 1) * p + pop },
      ],
    };
  }, [dx, dy, endScale, progress]);

  const glowStyle = useAnimatedStyle(
    () => ({ opacity: Math.sin(progress.value * Math.PI) * 0.8 }),
    [progress],
  );

  return (
    <Animated.View
      testID={`flight-${plan.tileId}`}
      style={[
        styles.tile,
        {
          left: from.left,
          top: from.top,
          width: from.width,
          height: from.height,
        },
        style,
      ]}
    >
      <Text style={{ fontSize: from.width * 0.5 }}>
        {getTileArt(plan.typeId).glyph}
      </Text>
      {colorFriendly ? (
        <TileBadge typeId={plan.typeId} size={Math.round(from.width * 0.34)} />
      ) : null}
      <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
    </Animated.View>
  );
}

/** A matched tile swelling and fading where it sat in the tray. */
function BurstGhost({ rect, typeId }: { rect: Rect; typeId: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    // Wait for the third tile to land before popping.
    progress.value = withDelay(
      ANIMATION.flightMs,
      withTiming(1, { duration: ANIMATION.burstMs }),
    );
  }, [progress]);

  // First the three tiles hop up and flash white, then swell and fade away.
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const hop = Math.sin(Math.min(p / 0.4, 1) * (Math.PI / 2));
    const out = p < 0.4 ? 0 : (p - 0.4) / 0.6;
    return {
      opacity: 1 - out,
      transform: [
        { translateY: -14 * hop * (1 - out) },
        { scale: 1 + 0.25 * hop + 0.7 * out },
      ],
    };
  }, [progress]);

  const flashStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const hop = Math.sin(Math.min(p / 0.4, 1) * (Math.PI / 2));
    return { opacity: p < 0.4 ? hop * 0.85 : 0.85 * (1 - (p - 0.4) / 0.6) };
  }, [progress]);

  return (
    <Animated.View
      testID="burst-ghost"
      style={[
        styles.ghost,
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        style,
      ]}
    >
      <Text style={styles.ghostGlyph}>{getTileArt(typeId).glyph}</Text>
      <Animated.View pointerEvents="none" style={[styles.glow, flashStyle]} />
    </Animated.View>
  );
}

function Spark({ rect, index }: { rect: Rect; index: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      ANIMATION.flightMs,
      withTiming(1, { duration: ANIMATION.burstMs }),
    );
  }, [progress]);
  const angle = (index / 8) * Math.PI * 2;
  const style = useAnimatedStyle(
    () => ({
      opacity: 1 - progress.value,
      transform: [
        { translateX: Math.cos(angle) * 28 * progress.value },
        { translateY: Math.sin(angle) * 28 * progress.value },
        { scale: 1 - progress.value * 0.45 },
      ],
    }),
    [angle, progress],
  );
  return (
    <Animated.View
      style={[
        styles.spark,
        {
          left: rect.left + rect.width / 2 - 4,
          top: rect.top + rect.height / 2 - 4,
        },
        index % 2 === 0 ? styles.sparkGold : styles.sparkWhite,
        style,
      ]}
    />
  );
}

function MatchBurst({ plan }: { plan: BurstPlan }) {
  return (
    <>
      {plan.rects.map((rect, i) => (
        <BurstGhost key={i} rect={rect} typeId={plan.typeId} />
      ))}
      <MatchCelebration rects={plan.rects} crown={plan.crown} />
      {plan.rects.map((rect, tileIndex) =>
        Array.from({ length: 8 }, (_, i) => (
          <Spark key={`${tileIndex}-${i}`} rect={rect} index={i} />
        )),
      )}
    </>
  );
}

/** Red flash and a short shake on a covered tile that was tapped. */
function RejectFlash({ plan }: { plan: FlashPlan }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: ANIMATION.flashMs });
  }, [progress]);

  const style = useAnimatedStyle(
    () => ({
      opacity: 0.6 * (1 - progress.value),
      transform: [{ translateX: Math.sin(progress.value * Math.PI * 4) * 6 }],
    }),
    [progress],
  );

  const { rect } = plan;
  return (
    <Animated.View
      testID="reject-flash"
      style={[
        styles.flash,
        {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
        style,
      ]}
    />
  );
}

/**
 * One absolutely positioned layer over the play area. It never receives
 * touches, and nothing on the board itself animates, so a 150-tile board
 * costs nothing extra while idle.
 */
export function AnimationLayer({ plan }: { plan: AnimationPlan }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {plan.bursts.map(b => (
        <MatchBurst key={b.key} plan={b} />
      ))}
      {plan.flashes.map(f => (
        <RejectFlash key={f.key} plan={f} />
      ))}
      {plan.flights.map(f => (
        <FlyingTile key={f.key} plan={f} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B2A10',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 12,
    backgroundColor: colors.tileFace,
    borderWidth: 1,
    borderColor: colors.tileEdge,
    borderBottomWidth: 4,
    borderRadius: 10,
  },
  ghost: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tileFace,
    borderWidth: 1,
    borderColor: colors.tileEdge,
    borderBottomWidth: 4,
    borderRadius: 6,
  },
  ghostGlyph: { fontSize: 20 },
  glow: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 238, 140, 0.85)',
  },
  flash: {
    position: 'absolute',
    backgroundColor: colors.danger,
    borderRadius: 10,
  },
  spark: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
  sparkGold: { backgroundColor: '#FFF176' },
  sparkWhite: { backgroundColor: '#FFFFFF' },
});
