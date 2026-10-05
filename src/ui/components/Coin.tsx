import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@ui/theme/tokens';

/**
 * A gold coin drawn with views. The coin emoji is missing from many fonts
 * (it shows as an empty box), so nothing here depends on the font.
 */
export function Coin({ size = 24 }: { size?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.outer,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <View
        style={[
          styles.inner,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: size * 0.36,
          },
        ]}
      >
        <Text style={[styles.mark, { fontSize: size * 0.5 }]}>$</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    backgroundColor: '#D98E0B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    backgroundColor: colors.coin,
    borderWidth: 1,
    borderColor: '#FFE08A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: { fontWeight: '900', color: '#B7740A', includeFontPadding: false },
});
