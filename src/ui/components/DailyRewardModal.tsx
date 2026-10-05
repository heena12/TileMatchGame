import React, { useState } from 'react';
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { DAILY_REWARDS } from '@config/dailyReward';
import type { WalletGrant } from '@state/progressStore';
import { evaluateDaily } from '@state/daily/dailyReward';
import { useProgress } from '@state/StoresContext';
import type { StringKey } from '@ui/i18n/strings';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { Button } from '@ui/components/Button';
import {
  colors,
  fontSize,
  radius,
  spacing,
  textOutline,
} from '@ui/theme/tokens';

const BOOSTER_GLYPH: Readonly<Record<string, string>> = {
  undo: '↩️',
  hint: '🪄',
  shuffle: '🔀',
};

const BOOSTER_NAME: Readonly<Record<string, StringKey>> = {
  undo: 'booster.undo',
  hint: 'booster.hint',
  shuffle: 'booster.shuffle',
};

/** One short line describing a reward, e.g. "+40 coins, Wand". */
export function describeReward(reward: WalletGrant): string {
  const parts: string[] = [];
  if (reward.coins) {
    parts.push(t('daily.coins', { coins: reward.coins }));
  }
  for (const [name, count] of Object.entries(reward.boosters ?? {})) {
    const key = BOOSTER_NAME[name];
    if (key && count) {
      parts.push(count > 1 ? `${t(key)} x${count}` : t(key));
    }
  }
  return parts.join(', ');
}

interface Props {
  onClose: () => void;
}

/** Shows the 7-day reward row and lets the player claim today's reward. */
export function DailyRewardModal({ onClose }: Props) {
  useLanguage();
  const record = useProgress(s => s.dailyReward);
  const claimDailyReward = useProgress(s => s.claimDailyReward);
  const [justClaimed, setJustClaimed] = useState<WalletGrant | null>(null);
  // Read once when opened, so the card does not flip at midnight under the player.
  const [openedAt] = useState(() => Date.now());
  const status = evaluateDaily(record, openedAt);
  // After claiming, the record is today's; the highlighted day is the one claimed.
  const highlightDay = justClaimed
    ? ((record.streak - 1) % DAILY_REWARDS.length) + 1
    : status.cycleDay;
  const claimable = status.available && !justClaimed;

  React.useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);

  const claim = () => setJustClaimed(claimDailyReward());

  return (
    <View testID="daily-modal" style={styles.overlay}>
      <Animated.View entering={FadeIn} style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('settings.close')}
          onPress={onClose}
          style={styles.fill}
        />
      </Animated.View>
      <Animated.View entering={ZoomIn} style={styles.panel}>
        <Pressable
          testID="daily-close"
          accessibilityRole="button"
          accessibilityLabel={t('settings.close')}
          hitSlop={8}
          onPress={onClose}
          style={styles.close}
        >
          <Text style={styles.closeGlyph}>✕</Text>
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>
          {t('daily.title')}
        </Text>
        <Text testID="daily-streak" style={styles.subtitle}>
          {t('daily.streak', {
            days: claimable ? record.streak : status.streak,
          })}
        </Text>

        <View style={styles.days}>
          {DAILY_REWARDS.map((reward, i) => {
            const day = i + 1;
            const current = day === highlightDay;
            const done = !claimable && day <= highlightDay;
            return (
              <View
                key={day}
                testID={`daily-day-${day}`}
                accessibilityLabel={`${t('daily.day', {
                  day,
                })}: ${describeReward(reward)}`}
                style={[
                  styles.day,
                  current && styles.dayCurrent,
                  done && styles.dayDone,
                ]}
              >
                <Text style={styles.dayLabel}>{t('daily.day', { day })}</Text>
                <Text style={styles.dayGlyph}>
                  {done ? '✅' : reward.boosters ? '🎁' : '🪙'}
                </Text>
                <Text style={styles.dayCoins}>{reward.coins ?? ''}</Text>
                {reward.boosters ? (
                  <Text style={styles.dayBooster}>
                    {Object.keys(reward.boosters)
                      .map(name => BOOSTER_GLYPH[name] ?? '')
                      .join('')}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>

        {justClaimed ? (
          <Text testID="daily-received" style={styles.message}>
            {t('daily.received', { reward: describeReward(justClaimed) })}
          </Text>
        ) : claimable ? (
          <Text style={styles.message}>{describeReward(status.reward)}</Text>
        ) : (
          <Text testID="daily-wait" style={styles.message}>
            {t('daily.comeBack')}
          </Text>
        )}

        {claimable ? (
          <Button
            testID="daily-claim"
            title={t('daily.claim')}
            onPress={claim}
          />
        ) : (
          <Button
            testID="daily-done"
            variant="secondary"
            title={t('settings.close')}
            onPress={onClose}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    zIndex: 20,
    elevation: 20,
  },
  fill: { ...StyleSheet.absoluteFill },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(8, 16, 30, 0.62)',
  },
  panel: {
    alignSelf: 'stretch',
    padding: spacing.md,
    gap: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: colors.panel,
  },
  close: {
    position: 'absolute',
    top: -14,
    right: -6,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8452C',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  closeGlyph: { fontSize: 16, fontWeight: '900', color: '#FFFFFF' },
  title: {
    textAlign: 'center',
    fontSize: fontSize.title,
    fontWeight: '900',
    color: '#E0A030',
    ...textOutline,
  },
  subtitle: {
    textAlign: 'center',
    fontSize: fontSize.body,
    fontWeight: '800',
    color: colors.panelText,
  },
  days: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  day: {
    width: 70,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: '#E4D6B5',
    backgroundColor: colors.panelInset,
  },
  dayCurrent: { borderColor: '#F29B22', backgroundColor: '#FFE9B0' },
  dayDone: { opacity: 0.75 },
  dayLabel: {
    fontSize: fontSize.caption,
    fontWeight: '800',
    color: colors.panelText,
  },
  dayGlyph: { fontSize: 24 },
  dayCoins: {
    fontSize: fontSize.caption,
    fontWeight: '900',
    color: colors.panelText,
  },
  dayBooster: { fontSize: 14 },
  message: {
    textAlign: 'center',
    fontSize: fontSize.body,
    fontWeight: '800',
    color: colors.panelText,
  },
});
