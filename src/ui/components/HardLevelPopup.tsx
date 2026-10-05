import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

const SHOW_MS = 2600;

/** "56% players feel this level is hard": a green bubble over the board at level start. */
export function HardLevelPopup({
  percent,
  animate,
  variant = 'hard',
}: {
  percent: number;
  animate: boolean;
  /** Two wordings, as in the reference game. */
  variant?: 'hard' | 'fail';
}) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setTimeout(() => setVisible(false), SHOW_MS);
    return () => clearTimeout(id);
  }, []);
  if (!visible) {
    return null;
  }
  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View
        testID="hard-level-popup"
        entering={animate ? ZoomIn.duration(300) : undefined}
        style={styles.bubble}
      >
        <Text style={styles.text}>
          <Text style={styles.percent}>{`${percent}%`}</Text>
          {variant === 'fail'
            ? ' players fail in the\nlevel'
            : ' players feel this\nlevel is hard'}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 20,
  },
  bubble: {
    paddingHorizontal: 26,
    paddingVertical: 14,
    borderRadius: 22,
    backgroundColor: '#2FAF6E',
    borderWidth: 2,
    borderColor: '#8EE6B4',
    elevation: 20,
  },
  text: {
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  percent: { fontSize: 18, fontWeight: '900', color: '#FFE45C' },
});
