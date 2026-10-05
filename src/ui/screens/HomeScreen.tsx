import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_CONFIG } from '@config/constants';
import { startLevel } from '@navigation/startLevel';
import type { RootScreenProps } from '@navigation/types';
import { evaluateDaily } from '@state/daily/dailyReward';
import { PUZZLE_PIECES } from '@state/puzzle';
import {
  useGameController,
  useProgress,
  useSavedGame,
} from '@state/StoresContext';
import { Button } from '@ui/components/Button';
import { DailyRewardModal } from '@ui/components/DailyRewardModal';
import { SettingsModal } from '@ui/components/SettingsModal';
import { CoinPill } from '@ui/components/CoinPill';
import { IdleMotion } from '@ui/components/IdleMotion';
import { PuzzleFrame } from '@ui/components/PuzzleFrame';
import { RoundButton } from '@ui/components/RoundButton';
import { RoomBackground } from '@ui/game/RoomBackground';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import {
  colors,
  fontSize,
  radius,
  spacing,
  textOutline,
} from '@ui/theme/tokens';

export function HomeScreen({ navigation }: RootScreenProps<'Home'>) {
  useLanguage();
  const insets = useSafeAreaInsets();
  const coins = useProgress(s => s.coins);
  const highest = useProgress(s => s.highestUnlockedLevel);
  const nextLevel = Math.min(highest, APP_CONFIG.maxLevels);
  // Each cleared level uncovers one piece of the picture; it resets every four.
  const piecesDone = (nextLevel - 1) % PUZZLE_PIECES;
  const saved = useSavedGame(s => s.summary);
  const controller = useGameController();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dailyOpen, setDailyOpen] = useState(false);
  const tutorialDone = useProgress(s => s.tutorialCompleted);
  const dailyRecord = useProgress(s => s.dailyReward);
  // Re-read on focus, so a reward is offered again after midnight.
  const [now, setNow] = useState(() => Date.now());
  const dailyReady = tutorialDone && evaluateDaily(dailyRecord, now).available;

  // Offer a waiting reward once per launch, the first time Home is shown.
  const offered = useRef(false);
  useEffect(() => {
    if (dailyReady && !offered.current) {
      offered.current = true;
      setDailyOpen(true);
    }
  }, [dailyReady]);

  // Coming back after a win with a new piece earned: play the reveal on it.
  const [celebrate, setCelebrate] = useState(0);
  const lastSeen = useRef(piecesDone);
  const current = useRef(piecesDone);
  current.current = piecesDone;
  useEffect(
    () =>
      navigation.addListener('focus', () => {
        setNow(Date.now());
        if (current.current > lastSeen.current) {
          setCelebrate(k => k + 1);
        }
        lastSeen.current = current.current;
      }),
    [navigation],
  );

  // Build the level you are about to play while the Home screen is idle.
  useEffect(() => {
    const id = setTimeout(() => controller.prefetch(nextLevel), 900);
    return () => clearTimeout(id);
  }, [controller, nextLevel]);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: spacing.md + insets.top,
          paddingBottom: spacing.md + insets.bottom,
        },
      ]}
    >
      <RoomBackground />
      <View style={styles.topBar}>
        <View style={styles.topGroup}>
          <RoundButton
            testID="home-settings"
            glyph="⚙️"
            label={t('home.settings')}
            onPress={() => setSettingsOpen(true)}
          />
          {tutorialDone ? (
            <View>
              <RoundButton
                testID="home-daily"
                glyph="🎁"
                label={dailyReady ? t('daily.button') : t('daily.title')}
                onPress={() => setDailyOpen(true)}
              />
              {dailyReady ? (
                <View
                  testID="home-daily-badge"
                  pointerEvents="none"
                  style={styles.badge}
                />
              ) : null}
            </View>
          ) : null}
          <RoundButton
            testID="home-play"
            glyph="🗺️"
            label={t('home.play')}
            onPress={() => navigation.navigate('LevelMap')}
          />
        </View>
        <CoinPill
          testID="home-coins"
          text={t('home.coins', { coins })}
          onShop={() => navigation.navigate('Shop')}
        />
      </View>

      <View style={styles.hero}>
        <IdleMotion kind="bird">
          <Text style={styles.mascot}>🐥</Text>
        </IdleMotion>
        <IdleMotion kind="sway">
          <View style={styles.logo}>
            <Text style={styles.logoTop}>TILE</Text>
            <Text accessibilityRole="header" style={styles.logoText}>
              EXPLORER
            </Text>
          </View>
        </IdleMotion>

        <View style={styles.puzzle}>
          <PuzzleFrame
            revealed={piecesDone}
            pieceSize={84}
            playKey={celebrate}
            revealDelayMs={450}
          />
        </View>
      </View>

      <View pointerEvents="none" style={styles.panda}>
        <Text style={styles.pandaGlyph}>🐼</Text>
      </View>

      <View style={styles.actions}>
        {saved ? (
          <Button
            testID="home-resume"
            title={t('home.resume', { level: saved.levelId })}
            onPress={() =>
              navigation.navigate('Game', {
                levelId: saved.levelId,
                resume: true,
              })
            }
          />
        ) : null}
        <Button
          testID="home-continue"
          variant={saved ? 'secondary' : 'primary'}
          title={t('home.continue', { level: nextLevel })}
          onPress={() => startLevel(navigation, nextLevel)}
        />
      </View>
      {dailyOpen ? (
        <DailyRewardModal
          onClose={() => {
            setDailyOpen(false);
            setNow(Date.now());
          }}
        />
      ) : null}
      {settingsOpen ? (
        <SettingsModal
          onClose={() => setSettingsOpen(false)}
          onReplayTutorial={() =>
            navigation.navigate('Game', { levelId: 1, tutorial: true })
          }
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  puzzle: { marginTop: spacing.xl + spacing.sm },
  container: {
    flex: 1,
    padding: spacing.md,
    backgroundColor: '#56A5D8',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topGroup: { flexDirection: 'row', gap: spacing.sm },
  badge: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#E8452C',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 3,
    borderColor: '#FFF4C7',
    borderBottomWidth: 7,
    backgroundColor: '#F29B22',
    borderBottomColor: '#CC3D1D',
    transform: [{ rotate: '-2deg' }],
  },
  logoTop: {
    fontSize: 34,
    lineHeight: 35,
    fontWeight: '900',
    color: '#FFFFFF',
    ...textOutline,
  },
  logoText: {
    fontSize: fontSize.title,
    fontWeight: '900',
    color: colors.onBackground,
    ...textOutline,
  },
  mascot: { fontSize: 44, marginBottom: -12 },
  panda: {
    position: 'absolute',
    left: 10,
    bottom: 14,
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#BFE3FF',
  },
  pandaGlyph: { fontSize: 26 },
  actions: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.xl },
});
