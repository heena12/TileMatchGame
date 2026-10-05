import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { RootScreenProps } from '@navigation/types';
import { useGameController } from '@state/StoresContext';
import { APP_CONFIG } from '@config/constants';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { textOutline } from '@ui/theme/tokens';

const QUOTES: readonly { text: string; author: string }[] = [
  { text: 'Perseverance is the key to success.', author: 'Socrates' },
  {
    text: 'Life is 10 percent what you make it, and 90 percent how you take it.',
    author: 'Irving Berlin',
  },
  {
    text: 'The journey of a thousand miles begins with a single step.',
    author: 'Lao Tzu',
  },
  {
    text: 'It always seems impossible until it is done.',
    author: 'Nelson Mandela',
  },
];

const BAND_COUNT = 48;
const TOP: readonly number[] = [0x16, 0x76, 0xde];
const BOTTOM: readonly number[] = [0xa3, 0xd6, 0xf7];

/** Top-to-bottom blue of the brand screen, drawn as many thin bands (no gradient library). */
const BAND_STYLES = StyleSheet.create(
  Object.fromEntries(
    Array.from({ length: BAND_COUNT }, (_, i) => {
      const mix = (c: number) =>
        Math.round(
          (TOP[c] as number) +
            ((BOTTOM[c] as number) - (TOP[c] as number)) *
              (i / (BAND_COUNT - 1)),
        );
      return [
        `b${i}`,
        { backgroundColor: `rgb(${mix(0)},${mix(1)},${mix(2)})` },
      ];
    }),
  ),
) as Readonly<Record<string, object>>;

function BrandStage() {
  return (
    <View testID="splash-brand" style={styles.brand}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: BAND_COUNT }, (_, i) => (
          <View key={i} style={[styles.band, BAND_STYLES[`b${i}`]]} />
        ))}
      </View>
      <Text accessibilityRole="header" style={styles.studio}>
        {t('splash.studio')}
      </Text>
      <Text style={styles.studioSub}>{t('splash.studioSub')}</Text>
    </View>
  );
}

/** The tower drawn with views, because the tower emoji is missing or odd in many fonts. */
function EiffelTower() {
  return (
    <View style={styles.tower}>
      <View style={styles.towerSpire} />
      <View style={styles.towerTop} />
      <View style={styles.towerMid} />
      <View style={styles.towerBase}>
        <View style={styles.towerArch} />
      </View>
    </View>
  );
}

/** A round-cornered airplane window onto a sunny landscape. */
function AirplaneWindow() {
  return (
    <View style={styles.windowOuter}>
      <View style={styles.windowRim}>
        <View style={styles.windowGlass}>
          <View style={styles.cloud} />
          <View style={[styles.cloud, styles.cloudLow]} />
          <EiffelTower />
          <Text style={styles.bird}>🐥</Text>
          <View style={styles.hillBack} />
          <View style={styles.hill} />
        </View>
      </View>
    </View>
  );
}

function LoadingStage({ quoteIndex }: { quoteIndex: number }) {
  const insets = useSafeAreaInsets();
  const quote = QUOTES[quoteIndex % QUOTES.length] ?? QUOTES[0];
  const fill = useSharedValue(0);
  useEffect(() => {
    fill.value = withTiming(1, {
      duration: APP_CONFIG.splashDurationMs - APP_CONFIG.splashBrandMs,
      easing: Easing.out(Easing.quad),
    });
  }, [fill]);
  const fillStyle = useAnimatedStyle(
    () => ({ width: `${Math.round(fill.value * 100)}%` }),
    [fill],
  );

  return (
    <View
      testID="splash-loading"
      style={[
        styles.loading,
        { paddingTop: 70 + insets.top, paddingBottom: 40 + insets.bottom },
      ]}
    >
      <View style={styles.quoteBlock}>
        <Text style={styles.quote}>{quote?.text}</Text>
        <Text style={styles.author}>{`- ${quote?.author}`}</Text>
      </View>
      <AirplaneWindow />
      <Text accessibilityRole="header" style={styles.title}>
        {t('app.title')}
      </Text>
      <View style={styles.progressBlock}>
        <Text style={styles.caption}>{t('splash.loading')}</Text>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, fillStyle]} />
        </View>
      </View>
    </View>
  );
}

/** Brand screen first, then the loading screen with a quote and progress bar. */
export function SplashScreen({ navigation }: RootScreenProps<'Splash'>) {
  useLanguage();
  const [stage, setStage] = useState<'brand' | 'loading'>('brand');
  const [quoteIndex] = useState(() => new Date().getDate());
  const controller = useGameController();

  // The splash is idle time: start the sound engine now so the first move is smooth.
  useEffect(() => {
    const id = setTimeout(() => controller.warmUp(), 400);
    return () => clearTimeout(id);
  }, [controller]);

  useEffect(() => {
    const toLoading = setTimeout(
      () => setStage('loading'),
      APP_CONFIG.splashBrandMs,
    );
    const toHome = setTimeout(
      () => navigation.replace('Home'),
      APP_CONFIG.splashDurationMs,
    );
    return () => {
      clearTimeout(toLoading);
      clearTimeout(toHome);
    };
  }, [navigation]);

  return stage === 'brand' ? (
    <BrandStage />
  ) : (
    <LoadingStage quoteIndex={quoteIndex} />
  );
}

const styles = StyleSheet.create({
  brand: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  band: { flex: 1 },
  studio: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 1,
    color: '#FFFFFF',
  },
  studioSub: {
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: 6,
    color: 'rgba(255,255,255,0.85)',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#3F97DE',
  },
  quoteBlock: { alignSelf: 'stretch', gap: 6 },
  quote: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', ...textOutline },
  author: {
    alignSelf: 'flex-end',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  windowOuter: {
    marginTop: 40,
    width: 270,
    height: 360,
    padding: 14,
    borderRadius: 135,
    backgroundColor: '#58ABF0',
  },
  windowRim: {
    flex: 1,
    padding: 18,
    borderRadius: 120,
    backgroundColor: '#3C8FDA',
  },
  windowGlass: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 100,
    backgroundColor: '#7CCBF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cloud: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 70,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    opacity: 0.9,
  },
  cloudLow: { top: 150, left: 18, right: undefined, width: 60 },
  tower: { position: 'absolute', bottom: 70, alignItems: 'center' },
  towerSpire: { width: 3, height: 16, backgroundColor: '#6B5B4E' },
  towerTop: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderBottomWidth: 34,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#7A6656',
  },
  towerMid: {
    width: 0,
    height: 0,
    borderLeftWidth: 13,
    borderRightWidth: 13,
    borderBottomWidth: 38,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#6B5B4E',
  },
  towerBase: {
    width: 44,
    height: 30,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: '#5E4F43',
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  towerArch: {
    width: 20,
    height: 20,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    backgroundColor: '#7CCBF2',
  },
  bird: { position: 'absolute', top: 100, left: 30, fontSize: 34 },
  hillBack: {
    position: 'absolute',
    bottom: -10,
    left: -40,
    width: 280,
    height: 110,
    borderRadius: 140,
    backgroundColor: '#8ED66B',
  },
  hill: {
    position: 'absolute',
    bottom: -30,
    right: -50,
    width: 280,
    height: 100,
    borderRadius: 140,
    backgroundColor: '#5DB84A',
  },
  title: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  progressBlock: {
    position: 'absolute',
    bottom: 50,
    left: 40,
    right: 40,
    alignItems: 'center',
    gap: 8,
  },
  caption: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
    ...textOutline,
  },
  track: {
    alignSelf: 'stretch',
    height: 18,
    padding: 3,
    borderRadius: 9,
    backgroundColor: '#1E5FB0',
    borderWidth: 2,
    borderColor: '#BFE0FA',
  },
  fill: { height: '100%', borderRadius: 6, backgroundColor: '#6FD22B' },
});
