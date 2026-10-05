import React from 'react';
import { StyleSheet, View } from 'react-native';

const SIZE = 64;
const COLUMNS = 7;
const ROWS = 16;
const TILE = SIZE * 0.72;

/** Faint diamond pattern behind the board, drawn once and never re-rendered. */
export const DiamondBackground = React.memo(function DiamondBackgroundView() {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: ROWS * COLUMNS }, (_, i) => {
        const row = Math.floor(i / COLUMNS);
        const col = i % COLUMNS;
        const shifted = row % 2 === 1;
        return (
          <View
            key={i}
            style={[
              styles.diamond,
              {
                left: col * SIZE + (shifted ? SIZE / 2 : 0) - SIZE / 2,
                top: row * (SIZE / 2) - SIZE / 4,
              },
            ]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  diamond: {
    position: 'absolute',
    width: TILE,
    height: TILE,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    transform: [{ rotate: '45deg' }],
  },
});
