import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, textOutline } from '@ui/theme/tokens';

interface Props {
  /** Emoji or short symbol drawn in the button. */
  glyph: string;
  label: string;
  onPress: () => void;
  testID?: string;
  /** `dark` is the brown button of the game screen. */
  tone?: 'light' | 'dark';
}

/** Small round icon button used in the top bars. */
export function RoundButton({
  glyph,
  label,
  onPress,
  testID,
  tone = 'light',
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        tone === 'dark' && styles.dark,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.glyph}>{glyph}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: 42,
    height: 42,
    borderRadius: 13,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderBottomWidth: 4,
    backgroundColor: '#6C7475',
    borderBottomColor: '#4D5557',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dark: {
    borderRadius: 21,
    borderColor: '#E9E1D0',
    backgroundColor: '#6A5E50',
    borderBottomColor: '#E9E1D0',
    borderBottomWidth: 3,
  },
  pressed: { opacity: 0.8 },
  glyph: { fontSize: 20, color: colors.onBackground, ...textOutline },
});
