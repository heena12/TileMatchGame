import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { textOutline } from '@ui/theme/tokens';

/** The bird blowing a horn above a blue ribbon, as on the level-clear screen. */
export function Mascot({ text, animate }: { text: string; animate: boolean }) {
  return (
    <Animated.View
      testID="mascot-banner"
      entering={animate ? ZoomIn.duration(650) : undefined}
      style={styles.wrap}
    >
      <Text style={styles.bird}>🐥</Text>
      <View style={styles.ribbon}>
        <View style={styles.flare} />
        <Text style={styles.text}>{text}</Text>
        <View style={[styles.flare, styles.flareRight]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  bird: { fontSize: 54, marginBottom: -14 },
  ribbon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 22,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#2F8FE0',
    borderWidth: 3,
    borderColor: '#BFE3FF',
    borderBottomWidth: 6,
    borderBottomColor: '#1B5FA8',
  },
  // Gold horn mouths either side of the ribbon, drawn so no emoji font is needed.
  flare: {
    width: 0,
    height: 0,
    borderTopWidth: 14,
    borderBottomWidth: 14,
    borderRightWidth: 22,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: '#F2B431',
  },
  flareRight: { transform: [{ scaleX: -1 }] },
  text: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', ...textOutline },
});
