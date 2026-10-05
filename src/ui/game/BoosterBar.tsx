import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { canShuffleBoard } from '@engine';
import { BOOSTER_PRICES } from '@config/boosters';
import type { BoosterKind } from '@config/boosters';
import type { BoosterOutcome } from '@state/gameController';
import {
  useGameController,
  useGameSession,
  useProgress,
  useTutorial,
} from '@state/StoresContext';
import { currentStep } from '@state/tutorialStore';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import type { StringKey } from '@ui/i18n/strings';
import { colors, spacing, textOutline } from '@ui/theme/tokens';

// Plain text symbols: emoji here render as empty boxes on some devices.
const ITEMS: readonly { kind: BoosterKind; glyph: string }[] = [
  { kind: 'undo', glyph: '↺' },
  { kind: 'hint', glyph: '✦' },
  { kind: 'shuffle', glyph: '↔' },
];

const NAME: Readonly<Record<BoosterKind, StringKey>> = {
  undo: 'booster.undo',
  hint: 'booster.hint',
  shuffle: 'booster.shuffle',
};

/** Why a press did nothing, in words. */
function explain(kind: BoosterKind, outcome: BoosterOutcome): StringKey | null {
  switch (outcome) {
    case 'used':
      return null;
    case 'unavailable':
      return 'booster.noCoins';
    case 'locked':
      return 'booster.locked';
    case 'not_possible':
      return kind === 'undo'
        ? 'booster.nothingToUndo'
        : kind === 'shuffle'
        ? 'booster.nothingToShuffle'
        : 'booster.noHint';
  }
}

const MESSAGE_MS = 2200;

/**
 * Undo, Wand and Shuffle. (The Wand's saved name is still `hint`; it collects a set of three.) A booster in stock shows how many are left; with none
 * in stock it shows its price in coins and buys one on use. A press that
 * cannot work never costs anything and says why.
 */
export function BoosterBar() {
  useLanguage();
  const controller = useGameController();
  const inventory = useProgress(s => s.inventory);
  const coins = useProgress(s => s.coins);
  const status = useGameSession(s => s.status);
  const game = useGameSession(s => s.game);
  const guided = useTutorial(s => currentStep(s) !== null);
  const [message, setMessage] = useState<StringKey | null>(null);

  useEffect(() => {
    if (message === null) {
      return undefined;
    }
    const id = setTimeout(() => setMessage(null), MESSAGE_MS);
    return () => clearTimeout(id);
  }, [message]);

  const playing = status === 'playing' && game !== null;
  const hasEffect = (kind: BoosterKind): boolean => {
    if (kind === 'undo') {
      return (game?.history.length ?? 0) > 0;
    }
    if (kind === 'shuffle') {
      return canShuffleBoard(game?.board ?? []);
    }
    return true;
  };

  const use = (kind: BoosterKind) => {
    setMessage(explain(kind, controller.useBooster(kind)));
  };

  return (
    <View style={styles.wrap}>
      {message ? (
        <Text
          testID="booster-message"
          accessibilityLiveRegion="polite"
          style={styles.message}
        >
          {t(message)}
        </Text>
      ) : null}
      <View style={styles.row}>
        {ITEMS.map(({ kind, glyph }) => {
          const stock = inventory[kind] ?? 0;
          const price = BOOSTER_PRICES[kind];
          const affordable = stock > 0 || coins >= price;
          const usable = playing && !guided && hasEffect(kind) && affordable;
          const name = t(NAME[kind]);
          const label =
            stock > 0
              ? t('booster.left', { name, count: stock })
              : t('booster.buy', { name, price });
          return (
            <Pressable
              key={kind}
              testID={`booster-${kind}`}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ disabled: !playing }}
              disabled={!playing}
              onPress={() => use(kind)}
              style={({ pressed }) => [
                styles.button,
                !usable && styles.dimmed,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.glyph}>{glyph}</Text>
              <View style={[styles.badge, stock === 0 && styles.priceBadge]}>
                <Text
                  testID={`booster-${kind}-badge`}
                  style={[styles.badgeText, stock === 0 && styles.priceText]}
                >
                  {stock > 0 ? stock : price}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.lg + 6, paddingBottom: spacing.md },
  message: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.onBackground,
    ...textOutline,
  },
  button: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 3,
    borderColor: '#E9E1D0',
    backgroundColor: '#6A5E50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.55 },
  pressed: { transform: [{ translateY: 2 }] },
  glyph: { fontSize: 30, fontWeight: '900', color: colors.onBackground },
  badge: {
    position: 'absolute',
    bottom: -8,
    minWidth: 24,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    backgroundColor: colors.danger,
    alignItems: 'center',
  },
  // With none in stock the badge shows the price instead, in coin colours.
  priceBadge: { backgroundColor: colors.coin },
  badgeText: { fontSize: 12, fontWeight: '800', color: colors.onBackground },
  priceText: { color: '#5A3B00' },
});
