import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RootScreenProps } from '@navigation/types';
import type { LeaderboardEntry } from '@services/leaderboard/ILeaderboardService';
import { useLeaderboard } from '@state/StoresContext';
import { Button } from '@ui/components/Button';
import { Screen } from '@ui/components/Screen';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import {
  colors,
  fontSize,
  radius,
  spacing,
  textOutline,
} from '@ui/theme/tokens';

/** How many places to show. */
const TOP_COUNT = 10;

type Load =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly entries: readonly LeaderboardEntry[] }
  | { readonly kind: 'error' };

/** The best scores for one level, as checked by the server. */
export function LeaderboardScreen({ route }: RootScreenProps<'Leaderboard'>) {
  useLanguage();
  const { levelId } = route.params;
  const leaderboard = useLeaderboard();
  const [load, setLoad] = useState<Load>({ kind: 'loading' });
  // Bumping this asks for a fresh load (the retry button).
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // An answer that arrives after leaving the screen, or after a newer
    // request started, is ignored.
    let current = true;
    setLoad({ kind: 'loading' });
    leaderboard
      .top(levelId, TOP_COUNT)
      .then(entries => {
        if (current) {
          setLoad({ kind: 'ready', entries });
        }
      })
      .catch(() => {
        if (current) {
          setLoad({ kind: 'error' });
        }
      });
    return () => {
      current = false;
    };
  }, [leaderboard, levelId, attempt]);

  return (
    <Screen title={t('board.level', { level: levelId })}>
      {load.kind === 'loading' ? (
        <Text testID="board-loading" style={styles.message}>
          {t('board.loading')}
        </Text>
      ) : null}

      {load.kind === 'error' ? (
        <>
          <Text testID="board-error" style={styles.message}>
            {t('board.error')}
          </Text>
          <Button
            testID="board-retry"
            title={t('board.retry')}
            onPress={() => setAttempt(n => n + 1)}
          />
        </>
      ) : null}

      {load.kind === 'ready' && load.entries.length === 0 ? (
        <Text testID="board-empty" style={styles.message}>
          {t('board.empty')}
        </Text>
      ) : null}

      {load.kind === 'ready' && load.entries.length > 0 ? (
        <View style={styles.panel}>
          {load.entries.map(entry => (
            <View
              key={entry.rank}
              testID={`board-row-${entry.rank}`}
              accessible
              accessibilityLabel={t('board.entry', {
                rank: entry.rank,
                name: entry.isYou ? t('board.you') : entry.name,
                score: entry.score,
                stars: entry.stars,
              })}
              style={[styles.row, entry.isYou && styles.you]}
            >
              <Text style={styles.rank}>{entry.rank}</Text>
              <Text style={styles.name} numberOfLines={1}>
                {entry.isYou ? t('board.you') : entry.name}
              </Text>
              <Text style={styles.score}>{entry.score}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  message: {
    fontSize: fontSize.body + 2,
    fontWeight: '700',
    color: colors.onBackground,
    ...textOutline,
  },
  panel: {
    alignSelf: 'stretch',
    padding: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: colors.panel,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.panelInset,
  },
  you: { backgroundColor: '#CDEBB8' },
  rank: {
    width: 28,
    fontSize: fontSize.body + 2,
    fontWeight: '800',
    color: colors.panelText,
  },
  name: {
    flex: 1,
    fontSize: fontSize.body,
    fontWeight: '700',
    color: colors.panelText,
  },
  score: {
    fontSize: fontSize.body + 2,
    fontWeight: '800',
    color: colors.panelText,
  },
});
