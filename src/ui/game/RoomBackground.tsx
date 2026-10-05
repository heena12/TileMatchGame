import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Calm blue room used by the reference game's hub and result screens. */
export const RoomBackground = React.memo(function RoomBackgroundView({
  dark = false,
}: {
  /** Night version used behind the level-clear banner. */
  dark?: boolean;
}) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View style={[styles.wall, dark && styles.darkWall]} />
      <View style={styles.light} />
      <View style={[styles.baseboard, dark && styles.darkBaseboard]} />
      <View style={[styles.floor, dark && styles.darkFloor]} />
      <View style={styles.plantStem} />
      <View style={[styles.leaf, styles.leafOne]} />
      <View style={[styles.leaf, styles.leafTwo]} />
      <View style={[styles.leaf, styles.leafThree]} />
      <View style={styles.pot} />
    </View>
  );
});

const styles = StyleSheet.create({
  darkWall: { backgroundColor: '#1D2A3A' },
  darkBaseboard: { backgroundColor: '#B9B1A0' },
  darkFloor: { backgroundColor: '#8A5A2B' },
  wall: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: '#56A5D8',
  },
  light: {
    position: 'absolute',
    top: -120,
    right: -145,
    width: 330,
    height: 680,
    backgroundColor: 'rgba(255,255,255,0.16)',
    transform: [{ rotate: '28deg' }],
  },
  baseboard: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 90,
    height: 8,
    backgroundColor: '#F5EFE2',
  },
  floor: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 90,
    backgroundColor: '#E6A85E',
  },
  plantStem: {
    position: 'absolute',
    right: 32,
    bottom: 68,
    width: 7,
    height: 120,
    borderRadius: 4,
    backgroundColor: '#4D8628',
    transform: [{ rotate: '8deg' }],
  },
  leaf: {
    position: 'absolute',
    width: 64,
    height: 24,
    borderRadius: 32,
    backgroundColor: '#70A91E',
  },
  leafOne: { right: 21, bottom: 150, transform: [{ rotate: '-42deg' }] },
  leafTwo: { right: 52, bottom: 128, transform: [{ rotate: '34deg' }] },
  leafThree: { right: 6, bottom: 110, transform: [{ rotate: '-35deg' }] },
  pot: {
    position: 'absolute',
    right: 10,
    bottom: 28,
    width: 58,
    height: 72,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: '#F5F3EE',
    transform: [{ skewX: '-5deg' }],
  },
});
