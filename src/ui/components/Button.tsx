import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  MIN_TOUCH_TARGET,
  colors,
  fontSize,
  radius,
  spacing,
  textOutline,
} from '@ui/theme/tokens';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  testID?: string;
  accessibilityLabel?: string;
}

/** Chunky candy-style button: a coloured face over a darker bottom edge. */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
  accessibilityLabel,
}: Props) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET + 8,
    minWidth: 200,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    borderBottomWidth: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.primary,
    borderBottomColor: colors.primaryEdge,
  },
  secondary: {
    backgroundColor: colors.secondary,
    borderBottomColor: colors.secondaryEdge,
  },
  pressed: { transform: [{ translateY: 3 }], borderBottomWidth: 4 },
  disabled: { opacity: 0.4 },
  label: {
    fontSize: fontSize.body + 4,
    fontWeight: '800',
    color: colors.primaryText,
    ...textOutline,
  },
});
