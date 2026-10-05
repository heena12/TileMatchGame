import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing, textOutline } from '@ui/theme/tokens';

interface Props {
  title?: string;
  /** Keep clear of the status bar. Off when a navigation header already does. */
  underStatusBar?: boolean;
  children?: React.ReactNode;
}

/** Common page frame: background, padding and an optional heading. */
export function Screen({ title, underStatusBar = false, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: spacing.md + (underStatusBar ? insets.top : 0),
          paddingBottom: spacing.md + insets.bottom,
        },
      ]}
    >
      {title ? (
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: fontSize.title + 6,
    fontWeight: '800',
    color: colors.onBackground,
    ...textOutline,
  },
});
