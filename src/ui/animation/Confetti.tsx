import React from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

const COLORS = ['#FF476F', '#FFD035', '#55C7F3', '#77D04B', '#9B69EC'];

/** Lightweight celebration particles; deterministic so tests and replays match. */
export function Confetti({ pieces = 28 }: { pieces?: number }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: pieces }, (_, i) => (
        <Animated.View
          key={i}
          entering={FadeIn.delay((i % 7) * 70).duration(650)}
          style={[
            styles.piece,
            {
              left: `${(i * 37 + 7) % 96}%`,
              top: `${(i * 53 + 3) % 78}%`,
              backgroundColor: COLORS[i % COLORS.length],
              transform: [{ rotate: `${(i * 47) % 180}deg` }],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  piece: { position: 'absolute', width: 7, height: 14, borderRadius: 2 },
});
