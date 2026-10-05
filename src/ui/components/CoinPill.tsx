import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, textOutline } from '@ui/theme/tokens';
import { Coin } from './Coin';

interface Props {
  /** Full text, so screens keep their own wording and tests keep their labels. */
  text: string;
  testID?: string;
  /** When given, a cart button next to the count opens the shop. */
  onShop?: () => void;
}

/** Coin counter shown in the top bars. */
export function CoinPill({ text, testID, onShop }: Props) {
  return (
    <View style={styles.pill}>
      <Coin size={24} />
      <Text testID={testID} style={styles.text}>
        {text}
      </Text>
      {onShop ? (
        <Pressable
          testID="open-shop"
          accessibilityRole="button"
          accessibilityLabel="Shop"
          hitSlop={6}
          onPress={onShop}
          style={styles.cart}
        >
          <Text style={styles.cartGlyph}>🛒</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  cart: {
    width: 26,
    height: 26,
    marginRight: -6,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  cartGlyph: { fontSize: 15 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.pill,
  },
  text: {
    fontSize: fontSize.body,
    fontWeight: '800',
    color: colors.onBackground,
    ...textOutline,
  },
});
