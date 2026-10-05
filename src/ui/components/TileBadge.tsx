import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/** Marks that tell look-alike tiles apart without relying on colour. */
export const BADGE_SHAPES = ['○', '△', '☆', '□', '◇', '♡'] as const;

/** The mark a picture always gets, so the same picture always looks the same. */
export function badgeShape(typeId: number): string {
  const index = Math.abs(Math.trunc(typeId)) % BADGE_SHAPES.length;
  return BADGE_SHAPES[index] ?? BADGE_SHAPES[0];
}

/**
 * Colour-friendly Mode: a small white badge with a shape in the corner of a
 * tile, as in the reference game. Pass `shape` to show a particular one.
 */
export function TileBadge({
  typeId,
  size,
  shape,
}: {
  typeId: number;
  size: number;
  shape?: string;
}) {
  const diameter = Math.max(10, size);
  return (
    <View
      testID="tile-badge"
      pointerEvents="none"
      style={[
        styles.badge,
        {
          width: diameter,
          height: diameter,
          borderRadius: diameter / 2,
        },
      ]}
    >
      <Text style={[styles.glyph, { fontSize: diameter * 0.74 }]}>
        {shape ?? badgeShape(typeId)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#8D939C',
  },
  glyph: { fontWeight: '900', color: '#4B5563', includeFontPadding: false },
});
