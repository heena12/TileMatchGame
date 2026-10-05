import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeInDown,
  FadeInUp,
  ZoomIn,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { APP_CONFIG } from '@config/constants';
import type { RootScreenProps } from '@navigation/types';
import {
  useGameController,
  useGameSession,
  useProgress,
  useTutorial,
} from '@state/StoresContext';
import { reviveCost } from '@config/revive';
import { HARD_THRESHOLD, hardPercent, passPercent } from '@state/difficulty';
import { praiseFor } from '@state/praise';
import { currentStep } from '@state/tutorialStore';
import { Button } from '@ui/components/Button';
import { CoinPill } from '@ui/components/CoinPill';
import { RoundButton } from '@ui/components/RoundButton';
import { AnimationLayer } from '@ui/animation/AnimationLayer';
import { Confetti } from '@ui/animation/Confetti';
import { ClearFlash } from '@ui/animation/ClearFlash';
import { HardLevelPopup } from '@ui/components/HardLevelPopup';
import { ReviveOverlay } from '@ui/components/ReviveOverlay';
import { PraiseBanner } from '@ui/animation/PraiseBanner';
import { EffectsBoundary } from '@ui/animation/EffectsBoundary';
import { ANIMATION } from '@ui/animation/timings';
import type { Geometry } from '@ui/animation/stepModel';
import { useStepAnimations } from '@ui/animation/useStepAnimations';
import { BoosterBar } from '@ui/game/BoosterBar';
import { DiamondBackground } from '@ui/game/DiamondBackground';
import { GameBoard } from '@ui/game/GameBoard';
import type { BoardGeometry } from '@ui/game/GameBoard';
import { Tray } from '@ui/game/Tray';
import { TutorialCoach } from '@ui/tutorial/TutorialCoach';
import { TutorialRings } from '@ui/tutorial/TutorialRings';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { colors, fontSize, spacing, textOutline } from '@ui/theme/tokens';

/** Until the tray reports its position; the first layout arrives before any tap. */
const TRAY_ORIGIN_FALLBACK = { left: 0, top: 0 };

export function GameScreen({ navigation, route }: RootScreenProps<'Game'>) {
  useLanguage();
  const { levelId, tutorial: replayTutorial, resume } = route.params;
  const controller = useGameController();
  const status = useGameSession(s => s.status);
  const game = useGameSession(s => s.game);
  const freeTileIds = useGameSession(s => s.freeTileIds);
  const score = useGameSession(s => s.score);
  const coins = useProgress(s => s.coins);
  const lastStep = useGameSession(s => s.lastStep);
  const revivesUsed = useGameSession(s => s.revivesUsed);
  const wandTileIds = useGameSession(s => s.wandTileIds);
  const reducedMotion = useReducedMotion();
  // The app draws edge to edge; keep controls clear of the status and gesture bars.
  const insets = useSafeAreaInsets();
  const step = useTutorial(s => currentStep(s));

  const [boardGeometry, setBoardGeometry] = useState<BoardGeometry | null>(
    null,
  );
  const [trayOrigin, setTrayOrigin] = useState(TRAY_ORIGIN_FALLBACK);
  const geometry: Geometry | null = useMemo(
    () => (boardGeometry ? { board: boardGeometry, tray: trayOrigin } : null),
    [boardGeometry, trayOrigin],
  );
  // Worked out once, from the opening board of each level (not on resume).
  const opening = useRef<{ levelId: number; percent: number } | null>(null);
  if (game && game.moves === 0 && opening.current?.levelId !== levelId) {
    opening.current = { levelId, percent: hardPercent(game.board) };
  }
  const showHard =
    opening.current?.levelId === levelId &&
    opening.current.percent >= HARD_THRESHOLD &&
    !replayTutorial &&
    levelId > APP_CONFIG.tutorialLevels &&
    status === 'playing' &&
    lastStep === null;
  const praise =
    lastStep && lastStep.events.some(e => e.type === 'TILES_MATCHED')
      ? praiseFor(score.combo.level, lastStep.seq)
      : null;
  const { plan, hiddenTileIds } = useStepAnimations(
    lastStep,
    geometry,
    reducedMotion,
  );

  // Stable, so the 150 memoized tiles are not re-rendered on every move.
  const onSelect = useCallback(
    (id: number) => controller.select(id),
    [controller],
  );

  const onTrayLayout = (event: LayoutChangeEvent) => {
    const { x, y } = event.nativeEvent.layout;
    setTrayOrigin({ left: x, top: y });
  };

  useEffect(() => {
    controller.start(levelId, {
      guided: replayTutorial === true,
      resume: resume === true,
    });
  }, [controller, levelId, replayTutorial, resume]);

  // Only leave for Result after THIS screen has seen the level being played,
  // so a finished session left over from an earlier run cannot bounce us out.
  // The short wait lets the last flight and match burst play out.
  const sawPlaying = useRef(false);
  useEffect(() => {
    if (status === 'playing') {
      sawPlaying.current = true;
    }
    // A lost level is not left at once: the revive screen decides.
    if (sawPlaying.current && status === 'won') {
      const id = setTimeout(
        () =>
          navigation.replace('Result', {
            levelId,
            won: true,
            tutorial: replayTutorial,
          }),
        reducedMotion ? 0 : ANIMATION.endDelayMs,
      );
      return () => clearTimeout(id);
    }
    return undefined;
  }, [status, levelId, navigation, reducedMotion, replayTutorial]);

  const giveUp = useCallback(
    () =>
      navigation.replace('Result', {
        levelId,
        won: false,
        tutorial: replayTutorial,
      }),
    [navigation, levelId, replayTutorial],
  );

  const quit = () => {
    controller.quit();
    navigation.goBack();
  };

  if (status === 'error') {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('game.error')}</Text>
        <Button title={t('game.retry')} onPress={() => controller.restart()} />
        <Button variant="secondary" title={t('game.quit')} onPress={quit} />
      </View>
    );
  }

  if (!game) {
    return (
      <View style={styles.center}>
        <Text style={styles.message}>{t('game.loading')}</Text>
      </View>
    );
  }

  const highlighted = step
    ? game.board.filter(tile => step.highlightTileIds.includes(tile.id))
    : [];

  const glowing = game.board.filter(tile => wandTileIds.includes(tile.id));

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: spacing.sm + insets.top,
          paddingBottom: spacing.xs + insets.bottom,
        },
      ]}
    >
      <DiamondBackground />
      <View style={styles.hud}>
        <View style={styles.hudSide}>
          <RoundButton
            testID="game-quit"
            tone="dark"
            glyph="←"
            label={t('game.quit')}
            onPress={quit}
          />
          <RoundButton
            testID="game-restart"
            tone="dark"
            glyph="↻"
            label={t('game.restart')}
            onPress={() => controller.restart()}
          />
        </View>
        <View style={styles.hudCentre}>
          <Text accessibilityRole="header" style={styles.hudTitle}>
            {t('game.level', { level: levelId })}
          </Text>
          <Text testID="game-score" style={styles.hudText}>
            {t('game.score', { score: score.score })}
          </Text>
        </View>
        <View style={[styles.hudSide, styles.hudEnd]}>
          <CoinPill
            text={String(coins)}
            onShop={() => navigation.navigate('Shop')}
          />
        </View>
      </View>
      {score.combo.level > 0 ? (
        // A new key re-mounts the badge, so it pops each time the combo grows.
        <Animated.Text
          key={score.combo.level}
          entering={ZoomIn.duration(200)}
          testID="game-combo"
          style={styles.combo}
        >
          {t('game.combo', { level: score.combo.level })}
        </Animated.Text>
      ) : null}

      <Animated.View
        onLayout={onTrayLayout}
        entering={reducedMotion ? undefined : FadeInUp.duration(380).delay(80)}
      >
        <Tray tray={game.tray} hiddenTileIds={hiddenTileIds} />
      </Animated.View>

      <TutorialCoach />

      <GameBoard
        board={game.board}
        freeTileIds={freeTileIds}
        onSelect={onSelect}
        onGeometry={setBoardGeometry}
      />

      <Animated.View
        entering={
          reducedMotion ? undefined : FadeInDown.duration(380).delay(160)
        }
      >
        <BoosterBar />
      </Animated.View>

      {status === 'lost' ? (
        <ReviveOverlay
          passPercent={passPercent(
            opening.current?.percent ??
              hardPercent([...game.board, ...game.tray]),
          )}
          cost={reviveCost(revivesUsed)}
          canRevive={game.history.length > 0}
          onRevive={() => controller.revive()}
          onRestart={() => controller.restart()}
          onGiveUp={giveUp}
        />
      ) : null}

      {/* One top layer for every effect, so nothing (the popup, banners,
          flying tiles) can end up under a tile on a real device. */}
      <View pointerEvents="box-none" style={styles.effects}>
        <EffectsBoundary>
          <TutorialRings tiles={highlighted} board={boardGeometry} />
          <TutorialRings
            tiles={glowing}
            board={boardGeometry}
            testIDPrefix="wand-ring"
            gold
          />
          <AnimationLayer plan={plan} />
          {showHard && opening.current ? (
            <HardLevelPopup
              key={levelId}
              percent={opening.current.percent}
              variant={levelId % 2 === 0 ? 'hard' : 'fail'}
              animate={!reducedMotion}
            />
          ) : null}
          {praise && lastStep && !reducedMotion && status === 'playing' ? (
            <PraiseBanner key={lastStep.seq} praise={praise} />
          ) : null}
          {status === 'won' ? (
            <View pointerEvents="none" style={styles.clearCelebration}>
              {!reducedMotion ? <Confetti pieces={36} /> : null}
              {!reducedMotion ? <ClearFlash /> : null}
              <Animated.Text
                entering={reducedMotion ? undefined : ZoomIn.duration(420)}
                style={styles.clearText}
              >
                Brilliant!
              </Animated.Text>
            </View>
          ) : null}
        </EffectsBoundary>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.sm + 2,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    gap: spacing.sm,
    backgroundColor: colors.gameBackground,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  message: { fontSize: fontSize.body, color: colors.text },
  hud: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  hudSide: { flex: 1, flexDirection: 'row', gap: spacing.sm },
  hudEnd: { justifyContent: 'flex-end' },
  hudCentre: { alignItems: 'center' },
  hudTitle: {
    fontSize: fontSize.body + 2,
    fontWeight: '800',
    color: colors.onBackground,
    ...textOutline,
  },
  hudText: { fontSize: fontSize.caption, fontWeight: '700', color: '#7A5C1E' },
  combo: {
    fontSize: fontSize.body,
    fontWeight: '800',
    color: colors.onBackground,
    ...textOutline,
  },
  // Above everything: on Android a higher elevation wins over zIndex, so both are set.
  effects: { ...StyleSheet.absoluteFill, zIndex: 100, elevation: 100 },
  clearCelebration: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearText: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 18,
    overflow: 'hidden',
    fontSize: fontSize.title + 4,
    fontWeight: '900',
    color: '#FFFFFF',
    backgroundColor: '#B75BE0',
    ...textOutline,
  },
});
