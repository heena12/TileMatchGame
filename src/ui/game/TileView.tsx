import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tile } from '@engine';
import { t } from '@ui/i18n/strings';
import { TileBadge } from '@ui/components/TileBadge';
import { colors } from '@ui/theme/tokens';
import { getTileArt } from '@ui/theme/tileArt';
import { tileRect } from './boardLayout';
import type { BoardOrigin } from './boardLayout';

interface Props {
  tile: Tile;
  free: boolean;
  cell: number;
  /** Logical cell drawn at the board's top-left. Must be a stable object. */
  origin: BoardOrigin;
  onSelect: (tileId: number) => void;
  /** Color-friendly mode: darker outlines and clearer blocked tiles. */
  contrast?: boolean;
  /** Only here so a change of language re-draws the label (the tile is memoized). */
  language?: string;
}

/**
 * One tile on the board. Memoized: with 150 tiles on screen, a move must only
 * re-render tiles whose `free` flag changed. `tile` objects are stable
 * (the engine never copies them) and `onSelect` must be stable too.
 */
function TileViewBase({
  tile,
  free,
  cell,
  origin,
  onSelect,
  contrast = false,
}: Props) {
  const art = getTileArt(tile.typeId);
  const rect = tileRect(tile, cell, origin);
  const inset = Math.max(1, Math.round(cell * 0.04));
  const size = rect.size - inset * 2;

  return (
    <View
      style={[
        styles.slot,
        {
          left: rect.left + inset,
          top: rect.top + inset,
          width: size,
          height: size,
          zIndex: tile.layer,
        },
      ]}
    >
      <Pressable
        testID={`tile-${tile.id}`}
        accessibilityRole="button"
        accessibilityLabel={t('game.tile', {
          name: art.name,
          state: t(free ? 'game.tileFree' : 'game.tileBlocked'),
        })}
        accessibilityState={{ disabled: !free }}
        onPress={() => onSelect(tile.id)}
        style={({ pressed }) => [
          styles.tile,
          free && styles.free,
          contrast && styles.contrast,
          pressed && free && styles.pressed,
          { borderRadius: cell * 0.18 },
        ]}
      >
        <Text style={{ fontSize: cell * 0.62 }}>{art.glyph}</Text>
        {contrast ? (
          <TileBadge typeId={tile.typeId} size={Math.round(cell * 0.34)} />
        ) : null}
        {free ? null : (
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.blocked,
              contrast && styles.blockedContrast,
              { borderRadius: cell * 0.18 },
            ]}
          />
        )}
      </Pressable>
    </View>
  );
}

export const TileView = memo(TileViewBase);

const styles = StyleSheet.create({
  slot: { position: 'absolute' },
  tile: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tileFace,
    borderWidth: 2,
    borderColor: colors.tileEdge,
    borderBottomWidth: 6,
    shadowColor: '#4B3B24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.34,
    shadowRadius: 2,
    elevation: 5,
  },
  free: { backgroundColor: '#FFFEFA' },
  pressed: { transform: [{ scale: 0.92 }, { translateY: 2 }] },
  blocked: { backgroundColor: colors.tileBlocked },
  contrast: { borderColor: '#2B2B33', borderWidth: 3 },
  blockedContrast: { backgroundColor: 'rgba(25, 30, 45, 0.6)' },
});
