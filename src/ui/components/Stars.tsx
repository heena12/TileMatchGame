import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { colors, fontSize } from '@ui/theme/tokens';

interface Props {
  count: number;
  size?: number;
  /** Earned stars pop in one after another. Off for reduced motion and small lists. */
  animate?: boolean;
}

const STAR_DELAY_MS = 180;

/** Three stars, filled up to `count`. */
export function Stars({
  count,
  size = fontSize.title,
  animate = false,
}: Props) {
  useLanguage();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={t('result.stars', { stars: count })}
    >
      {[1, 2, 3].map(n => {
        const earned = n <= count;
        return (
          <Animated.Text
            key={n}
            entering={
              animate && earned
                ? ZoomIn.delay(n * STAR_DELAY_MS).springify()
                : undefined
            }
            style={{
              fontSize: size,
              color: earned ? colors.star : colors.starOff,
            }}
          >
            ★
          </Animated.Text>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' } });
