import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Coin } from '@ui/components/Coin';
import { CoinPill } from '@ui/components/CoinPill';

const COIN_SIZE = 24;
const START_DELAY_MS = 700;
const FLIGHT_MS = 650;
const STAGGER_MS = 90;
/** The counter starts rising when the first coin lands and ends with the last. */
const COUNT_STEP_MS = 40;

interface Point {
  readonly x: number;
  readonly y: number;
}

/** How many coins fly for a reward: a few for small amounts, capped for big ones. */
export function flyingCoinCount(gained: number): number {
  return gained <= 0 ? 0 : Math.min(10, Math.max(4, Math.ceil(gained / 15)));
}

/** The counter value at `elapsedMs` after the first coin lands (pure, for tests). */
export function countedValue(
  from: number,
  to: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (elapsedMs <= 0) {
    return from;
  }
  if (elapsedMs >= durationMs) {
    return to;
  }
  return Math.round(from + ((to - from) * elapsedMs) / durationMs);
}

function FlyingCoin({
  index,
  start,
  end,
}: {
  index: number;
  start: Point;
  end: Point;
}) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(
      START_DELAY_MS + index * STAGGER_MS,
      withTiming(1, { duration: FLIGHT_MS, easing: Easing.in(Easing.quad) }),
    );
  }, [progress, index]);

  // Spread the coins out a little so they leave as a burst, not a single line.
  const spreadX = ((index * 37) % 61) - 30;
  const spreadY = ((index * 53) % 41) - 20;
  const dx = end.x - start.x;
  const dy = end.y - start.y;

  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const burst = Math.sin(Math.min(p * 2, 1) * (Math.PI / 2)) * (1 - p);
    return {
      opacity: p === 0 ? 0 : 1,
      transform: [
        { translateX: dx * p + spreadX * burst },
        { translateY: dy * p + spreadY * burst - 40 * burst },
        { scale: 1 - 0.35 * p },
      ],
    };
  }, [dx, dy, spreadX, spreadY, progress]);

  return (
    <Animated.View
      testID="flying-coin"
      style={[
        styles.coin,
        { left: start.x - COIN_SIZE / 2, top: start.y - COIN_SIZE / 2 },
        style,
      ]}
    >
      <Coin size={COIN_SIZE} />
    </Animated.View>
  );
}

/**
 * Coin counter for the win screen. Coins burst from `origin`, fly into the
 * counter at `target`, and the number climbs from `from` to `to` as they land.
 * With `animate` false it just shows the final total.
 */
export function CoinFly({
  from,
  to,
  origin,
  target,
  top,
  animate,
}: {
  from: number;
  to: number;
  origin: Point;
  target: Point;
  /** Distance from the top edge to the counter. */
  top: number;
  animate: boolean;
}) {
  const gained = to - from;
  const coins = animate ? flyingCoinCount(gained) : 0;
  const [value, setValue] = useState(animate ? from : to);

  useEffect(() => {
    if (!animate || gained <= 0) {
      setValue(to);
      return undefined;
    }
    const count = flyingCoinCount(gained);
    const lands = START_DELAY_MS + FLIGHT_MS;
    const duration = (count - 1) * STAGGER_MS + 1;
    const begun = Date.now();
    const id = setInterval(() => {
      const elapsed = Date.now() - begun - lands;
      setValue(countedValue(from, to, elapsed, duration));
      if (elapsed >= duration) {
        clearInterval(id);
      }
    }, COUNT_STEP_MS);
    return () => clearInterval(id);
  }, [animate, from, to, gained]);

  return (
    <>
      <View pointerEvents="none" style={[styles.pill, { top }]}>
        <CoinPill testID="result-coin-total" text={String(value)} />
      </View>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: coins }, (_, i) => (
          <FlyingCoin key={i} index={i} start={origin} end={target} />
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  pill: { position: 'absolute', right: 16 },
  coin: { position: 'absolute' },
});
