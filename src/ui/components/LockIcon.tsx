import React from 'react';
import { StyleSheet, View } from 'react-native';

/** A white padlock drawn with views, so it does not depend on an emoji font. */
export function LockIcon({ size = 26 }: { size?: number }) {
  const body = size * 0.72;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.box, { width: size, height: size }]}
    >
      <View
        style={[
          styles.shackle,
          {
            width: size * 0.5,
            height: size * 0.5,
            borderRadius: size * 0.25,
            borderWidth: size * 0.12,
          },
        ]}
      />
      <View
        style={[
          styles.body,
          {
            width: size * 0.82,
            height: body * 0.62,
            marginTop: -size * 0.06,
            borderRadius: size * 0.12,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center' },
  shackle: { borderColor: '#FFFFFF', backgroundColor: 'transparent' },
  body: { backgroundColor: '#FFFFFF' },
});
