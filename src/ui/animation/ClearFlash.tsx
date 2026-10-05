import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { textOutline } from '@ui/theme/tokens';

const RAINBOW = [
  '#FF3B6B',
  '#FF9F1C',
  '#FFE45C',
  '#5BD65B',
  '#3BC9FF',
  '#7B61FF',
  '#D65BFF',
];

/** A rainbow ribbon with "Clear!" that sweeps in over the tray when the board is emptied. */
export function ClearFlash() {
  return (
    <Animated.View
      testID="clear-flash"
      entering={ZoomIn.duration(260)}
      style={styles.wrap}
    >
      <View style={styles.ribbon}>
        {RAINBOW.map(color => (
          <View
            key={color}
            style={[styles.stripe, { backgroundColor: color }]}
          />
        ))}
      </View>
      <Text style={styles.text}>Clear!</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 70,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ribbon: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row',
    borderRadius: 14,
    overflow: 'hidden',
    opacity: 0.85,
  },
  stripe: { flex: 1 },
  text: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFE45C',
    ...textOutline,
  },
});
