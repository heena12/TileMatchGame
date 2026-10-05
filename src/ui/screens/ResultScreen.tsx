import React, { useState } from 'react';
import { Pressable } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  ZoomIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { APP_CONFIG } from '@config/constants';
import { startLevel } from '@navigation/startLevel';
import type { RootScreenProps } from '@navigation/types';
import {
  useGameSession,
  useLeaderboard,
  useProgress,
} from '@state/StoresContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@ui/components/Button';
import { Screen } from '@ui/components/Screen';
import { Mascot } from '@ui/components/Mascot';
import { PuzzleProgress } from '@ui/components/PuzzleProgress';
import { Stars } from '@ui/components/Stars';
import { CoinFly } from '@ui/animation/CoinFly';
import { Confetti } from '@ui/animation/Confetti';
import { RoomBackground } from '@ui/game/RoomBackground';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { fontSize, textOutline } from '@ui/theme/tokens';

export function ResultScreen({ navigation, route }: RootScreenProps<'Result'>) {
  useLanguage();
  const { levelId, won, tutorial } = route.params;
  // A replayed tutorial stays guided until its last level.
  const guidedNext = tutorial === true && levelId < APP_CONFIG.tutorialLevels;
  const status = useGameSession(s => s.status);
  const score = useGameSession(s => s.score);
  const result = useGameSession(s => s.result);
  const puzzleBonus = useGameSession(s => s.puzzleBonus);
  const coinsNow = useProgress(s => s.coins);
  const insets = useSafeAreaInsets();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const finished = status === 'won' || status === 'lost';
  const reducedMotion = useReducedMotion();
  const leaderboard = useLeaderboard();

  if (!finished) {
    return (
      <Screen underStatusBar>
        <Text style={styles.detail}>{t('result.none')}</Text>
        <Button
          title={t('result.home')}
          onPress={() => navigation.popToTop()}
        />
      </Screen>
    );
  }

  return (
    <View
      style={[styles.container, won && styles.winContainer]}
      onLayout={e => setSize(e.nativeEvent.layout)}
    >
      <RoomBackground dark={won} />
      {won && !reducedMotion ? <Confetti /> : null}
      {won && result && size.width > 0 ? (
        <CoinFly
          from={coinsNow - result.coins - puzzleBonus}
          to={coinsNow}
          origin={{ x: size.width / 2, y: size.height * 0.55 }}
          target={{ x: size.width - 16 - 52, y: insets.top + 14 + 17 }}
          top={insets.top + 14}
          animate={!reducedMotion}
        />
      ) : null}
      {won ? (
        <Mascot text="Brilliant!" animate={!reducedMotion} />
      ) : (
        <Animated.View
          entering={reducedMotion ? undefined : ZoomIn.duration(650)}
          style={styles.banner}
        >
          <Text style={styles.bannerText}>Try again!</Text>
        </Animated.View>
      )}
      {won ? (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.delay(300).duration(450)}
          style={styles.summary}
        >
          <Text accessibilityRole="header" style={styles.summaryTitle}>
            {t('result.won')}
          </Text>
          <Stars
            count={result?.stars ?? 0}
            size={26}
            animate={!reducedMotion}
          />
          <Text testID="result-score" style={styles.summaryText}>
            {t('result.score', { score: score.score })}
          </Text>
          {result ? (
            <Text testID="result-coins" style={styles.summaryCoins}>
              {t('result.coins', { coins: result.coins })}
            </Text>
          ) : null}
        </Animated.View>
      ) : (
        <Animated.View
          entering={reducedMotion ? undefined : FadeIn.delay(300).duration(450)}
          style={styles.card}
        >
          <Text accessibilityRole="header" style={styles.title}>
            {won ? t('result.won') : t('result.lost')}
          </Text>
          {won ? (
            <Stars
              count={result?.stars ?? 0}
              size={40}
              animate={!reducedMotion}
            />
          ) : null}
          <Text testID="result-score" style={styles.detail}>
            {t('result.score', { score: score.score })}
          </Text>
          {won && result ? (
            <Text testID="result-coins" style={styles.reward}>
              {t('result.coins', { coins: result.coins })}
            </Text>
          ) : null}
        </Animated.View>
      )}
      {won ? (
        <PuzzleProgress
          levelId={levelId}
          animate={!reducedMotion}
          bonus={puzzleBonus}
        />
      ) : null}

      {won ? (
        <View style={styles.winActions}>
          <Button
            testID="result-next"
            title={t('result.next')}
            onPress={() =>
              startLevel(navigation, levelId + 1, 'replace', {
                tutorial: guidedNext,
              })
            }
          />
          <View style={styles.links}>
            <TextLink
              testID="result-retry"
              title={t('result.retry')}
              onPress={() => navigation.replace('Game', { levelId, tutorial })}
            />
            {leaderboard.isAvailable ? (
              <TextLink
                testID="result-leaderboard"
                title={t('result.leaderboard')}
                onPress={() => navigation.navigate('Leaderboard', { levelId })}
              />
            ) : null}
            <TextLink
              testID="result-map"
              title={t('result.map')}
              onPress={() => navigation.navigate('LevelMap')}
            />
            <TextLink
              testID="result-home"
              title={t('result.home')}
              onPress={() => navigation.popToTop()}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            testID="result-retry"
            title={t('result.retry')}
            onPress={() => navigation.replace('Game', { levelId, tutorial })}
          />
          <Button
            testID="result-map"
            variant="secondary"
            title={t('result.map')}
            onPress={() => navigation.navigate('LevelMap')}
          />
          <Button
            testID="result-home"
            variant="secondary"
            title={t('result.home')}
            onPress={() => navigation.popToTop()}
          />
        </View>
      )}
    </View>
  );
}

/** Small underlined action under the Continue button on the win screen. */
function TextLink({
  title,
  onPress,
  testID,
}: {
  title: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      hitSlop={8}
      onPress={onPress}
      testID={testID}
    >
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  winContainer: { justifyContent: 'flex-start', paddingTop: 72, gap: 14 },
  summary: { alignItems: 'center', gap: 4 },
  summaryTitle: {
    fontSize: fontSize.body + 2,
    fontWeight: '800',
    color: '#DCEAF2',
  },
  summaryText: { fontSize: fontSize.body, fontWeight: '700', color: '#BFD3E6' },
  summaryCoins: {
    fontSize: fontSize.body,
    fontWeight: '900',
    color: '#FFD035',
  },
  winActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 28,
    alignItems: 'center',
    gap: 14,
  },
  links: { flexDirection: 'row', gap: 18 },
  link: {
    fontSize: fontSize.caption + 1,
    fontWeight: '700',
    color: '#FFFFFF',
    textDecorationLine: 'underline',
    ...textOutline,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    padding: 24,
    backgroundColor: '#56A5D8',
  },
  banner: {
    paddingHorizontal: 28,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#F5A623',
    borderWidth: 3,
    borderColor: '#FFE9A8',
    borderBottomWidth: 7,
    borderBottomColor: '#C84B20',
    transform: [{ rotate: '-2deg' }],
  },
  bannerText: {
    fontSize: 30,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  card: {
    width: 235,
    minHeight: 190,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 18,
    borderRadius: 14,
    borderWidth: 7,
    borderColor: '#3C6EB6',
    backgroundColor: '#DCEAF2',
    shadowColor: '#173A72',
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 8,
  },
  title: { fontSize: fontSize.title, fontWeight: '900', color: '#35557D' },
  detail: {
    fontSize: fontSize.body + 2,
    fontWeight: '700',
    color: '#35557D',
  },
  reward: { fontSize: fontSize.title, fontWeight: '900', color: '#D99200' },
  actions: { alignItems: 'center', gap: 10 },
});
