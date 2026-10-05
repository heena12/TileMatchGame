import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import type { Tile } from '@engine';
import { boardTileRect } from '@ui/animation/stepModel';
import type { Geometry } from '@ui/animation/stepModel';
import { colors } from '@ui/theme/tokens';

interface RingProps {
  tile: Tile;
  board: Geometry['board'];
  testIDPrefix: string;
  gold: boolean;
}

/** A pulsing ring around one tile. With reduced motion it simply stays lit. */
function Ring({ tile, board, testIDPrefix, gold }: RingProps) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      pulse.value = 1;
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [pulse, reduced]);

  const style = useAnimatedStyle(
    () => ({
      opacity: 0.55 + 0.45 * pulse.value,
      transform: [{ scale: 1 + 0.08 * pulse.value }],
    }),
    [pulse],
  );

  const rect = boardTileRect(tile, board);
  return (
    <Animated.View
      testID={`${testIDPrefix}-${tile.id}`}
      style={[
        styles.ring,
        gold && styles.gold,
        {
          left: rect.left - 3,
          top: rect.top - 3,
          width: rect.width + 6,
          height: rect.height + 6,
        },
        style,
      ]}
    />
  );
}

interface Props {
  tiles: readonly Tile[];
  board: Geometry['board'] | null;
  /** Test id stem; a tutorial step and a hint each get their own. */
  testIDPrefix?: string;
  /** Golden glow, used by the Wand; tutorial steps stay green. */
  gold?: boolean;
}

/** Highlights the tiles the current tutorial step is about. It never takes touches. */
export function TutorialRings({
  tiles,
  board,
  testIDPrefix = 'tutorial-ring',
  gold = false,
}: Props) {
  if (!board || tiles.length === 0) {
    return null;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {tiles.map(tile => (
        <Ring
          key={tile.id}
          tile={tile}
          board={board}
          testIDPrefix={testIDPrefix}
          gold={gold}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.primary,
    borderRadius: 14,
  },
  gold: {
    borderWidth: 4,
    borderColor: '#FFD035',
    backgroundColor: 'rgba(255, 224, 90, 0.5)',
    shadowColor: '#FFD035',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 12,
  },
});
