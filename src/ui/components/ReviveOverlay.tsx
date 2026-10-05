import React, { useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { REVIVE_COUNTDOWN_S } from '@config/revive';
import { ArcProgress } from '@ui/components/ArcProgress';
import { Coin } from '@ui/components/Coin';
import { CryingBird } from '@ui/components/CryingBird';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { spacing, textOutline } from '@ui/theme/tokens';

const RING_SIZE = 190;
/** The arc covers this much of the circle when the countdown starts, and shrinks from there. */
const ARC_AT_START = 0.45;
const BIRD_SCALE = 0.66;
const MESSAGE_MS = 2200;
const TICK_MS = 100;

/**
 * Shown over the whole screen when the tray fills up, laid out like the
 * reference game: the screen dims, a countdown ring sits under the tray, then
 * how few players pass the level, the crying chick, a Revive button and "Tap to
 * restart". When the countdown runs out the level is counted as failed.
 */
export function ReviveOverlay({
  passPercent,
  cost,
  canRevive,
  onRevive,
  onRestart,
  onGiveUp,
}: {
  passPercent: number;
  /** Coins the revive costs; 0 shows no price (the first revive is free). */
  cost: number;
  canRevive: boolean;
  /** Tries to revive; the overlay explains it if it could not. */
  onRevive: () => 'revived' | 'unavailable' | 'not_possible';
  onRestart: () => void;
  onGiveUp: () => void;
}) {
  useLanguage();
  // Lay out against the space this overlay really has. On the web the game
  // sits in a narrow column, so the browser window's width would be wrong.
  const window = useWindowDimensions();
  const [measured, setMeasured] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const width = measured?.width ?? window.width;
  const height = measured?.height ?? window.height;
  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    if (w > 0 && h > 0) {
      setMeasured({ width: w, height: h });
    }
  };
  const [remaining, setRemaining] = useState(REVIVE_COUNTDOWN_S);
  const [message, setMessage] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    const started = Date.now();
    const id = setInterval(() => {
      const left = REVIVE_COUNTDOWN_S - (Date.now() - started) / 1000;
      setRemaining(left);
      if (left <= 0 && !done.current) {
        done.current = true;
        clearInterval(id);
        onGiveUp();
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, [onGiveUp]);

  useEffect(() => {
    if (message === null) {
      return undefined;
    }
    const id = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(id);
  }, [message]);

  const revive = () => {
    if (done.current) {
      return;
    }
    const outcome = onRevive();
    if (outcome === 'unavailable') {
      setMessage(t('revive.noCoins'));
    } else if (outcome === 'not_possible') {
      setMessage(t('revive.cannot'));
    } else {
      done.current = true;
    }
  };

  const restart = () => {
    if (done.current) {
      return;
    }
    done.current = true;
    onRestart();
  };

  const buttonWidth = Math.min(width * 0.68, 320);
  const birdWidth = 300 * BIRD_SCALE;

  return (
    <Animated.View
      testID="revive-overlay"
      entering={FadeIn.duration(250)}
      onLayout={onLayout}
      style={styles.overlay}
    >
      <View
        testID="revive-ring"
        style={[
          styles.ring,
          { left: (width - RING_SIZE) / 2, top: height * 0.26 - RING_SIZE / 2 },
        ]}
      >
        <ArcProgress
          size={RING_SIZE}
          thickness={14}
          progress={
            (Math.max(remaining, 0) / REVIVE_COUNTDOWN_S) * ARC_AT_START
          }
        />
        <Text testID="revive-seconds" style={styles.seconds}>
          {Math.max(0, Math.ceil(remaining))}
        </Text>
      </View>

      <Text style={[styles.odds, { top: height * 0.4 }]}>
        {t('revive.oddsBefore')}
        <Text style={styles.oddsPercent}>{`${passPercent}%`}</Text>
        {t('revive.oddsAfter')}
      </Text>

      <View
        style={[
          styles.bird,
          { left: (width - birdWidth) / 2, top: height * 0.465 },
        ]}
      >
        <CryingBird scale={BIRD_SCALE} />
      </View>

      {canRevive ? (
        <Pressable
          testID="revive-button"
          accessibilityRole="button"
          accessibilityLabel={
            cost > 0 ? t('revive.buttonCost', { cost }) : t('revive.button')
          }
          onPress={revive}
          style={({ pressed }) => [
            styles.button,
            {
              width: buttonWidth,
              left: (width - buttonWidth) / 2,
              top: height * 0.675,
            },
            pressed && styles.pressed,
          ]}
        >
          <View style={styles.buttonShine} />
          <View style={styles.playIcon}>
            <Text style={styles.playGlyph}>▶</Text>
          </View>
          <Text style={styles.buttonText}>{t('revive.button')}</Text>
          {cost > 0 ? (
            <View testID="revive-cost" style={styles.cost}>
              <Coin size={20} />
              <Text style={styles.costText}>{cost}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}

      {message ? (
        <Text
          testID="revive-message"
          accessibilityLiveRegion="polite"
          style={[styles.message, { top: height * 0.775 }]}
        >
          {message}
        </Text>
      ) : null}

      <Pressable
        testID="revive-restart"
        accessibilityRole="button"
        accessibilityLabel={t('revive.restart')}
        onPress={restart}
        hitSlop={12}
        style={[styles.restartWrap, { top: height * 0.815 }]}
      >
        <Text style={styles.restart}>{t('revive.restart')}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(18, 12, 5, 0.78)',
    // Above the board, the tray and the boosters; the effects layer (100) stays on top.
    zIndex: 50,
    elevation: 50,
  },
  ring: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  seconds: {
    position: 'absolute',
    fontSize: 84,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(120, 190, 255, 0.9)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  odds: {
    position: 'absolute',
    left: 0,
    right: 0,
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    paddingHorizontal: spacing.sm,
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
  oddsPercent: { color: '#FF3B3B' },
  bird: { position: 'absolute' },
  button: {
    position: 'absolute',
    height: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 18,
    borderRadius: 26,
    backgroundColor: '#74C847',
    borderWidth: 3,
    borderColor: '#F4F1E6',
    borderBottomWidth: 7,
    borderBottomColor: '#3E8E1F',
    overflow: 'hidden',
  },
  buttonShine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 30,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  pressed: { transform: [{ translateY: 3 }], borderBottomWidth: 4 },
  playIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2E7D1E',
    borderWidth: 3,
    borderColor: '#F4F1E6',
  },
  playGlyph: { fontSize: 13, color: '#FFFFFF', marginLeft: 2 },
  buttonText: {
    fontSize: 38,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  cost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  costText: { fontSize: 15, fontWeight: '900', color: '#FFFFFF' },
  message: {
    position: 'absolute',
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    backgroundColor: 'rgba(60, 60, 60, 0.8)',
  },
  restartWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  restart: {
    fontSize: 20,
    fontWeight: '900',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
});
