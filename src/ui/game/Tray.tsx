import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { TRAY_SIZE } from '@engine';
import type { Tile } from '@engine';
import { useSettings } from '@state/StoresContext';
import { TileBadge } from '@ui/components/TileBadge';
import { t } from '@ui/i18n/strings';
import { useLanguage } from '@ui/i18n/useLanguage';
import { colors, radius } from '@ui/theme/tokens';
import { getTileArt } from '@ui/theme/tileArt';
import {
  TRAY_PADDING,
  TRAY_SLOT_GAP,
  TRAY_SLOT_HEIGHT,
  TRAY_SLOT_WIDTH,
} from './trayMetrics';

const TRAY_FRAME = 3;

interface Props {
  tray: readonly Tile[];
  /** Tiles still flying in; their slot stays empty until they land. */
  hiddenTileIds?: ReadonlySet<number>;
}

const SLOT_STRIDE = TRAY_SLOT_WIDTH + TRAY_SLOT_GAP;

/**
 * One tile in the tray. A tile that has just landed bounces; one that moved
 * because a match cleared (or another tile was inserted) slides from its old
 * slot. Both run on one shared value, so nothing has to be measured.
 */
function TrayTile({
  tile,
  slot,
  from,
  badge,
}: {
  tile: Tile;
  slot: number;
  from: number | undefined;
  badge: boolean;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) {
      progress.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    }
  }, [progress, reduced]);

  const slides = from !== undefined && from !== slot;
  const offset = slides ? (from - slot) * SLOT_STRIDE : 0;
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      transform: [
        { translateX: offset * (1 - p) },
        { scale: slides ? 1 : 0.55 + 0.45 * p + 0.18 * Math.sin(p * Math.PI) },
      ],
    };
  }, [progress, offset, slides]);

  return (
    <Animated.View
      style={[
        styles.face,
        { borderBottomColor: getTileArt(tile.typeId).accent },
        style,
      ]}
    >
      <Text style={styles.glyph}>{getTileArt(tile.typeId).glyph}</Text>
      {badge ? <TileBadge typeId={tile.typeId} size={14} /> : null}
    </Animated.View>
  );
}

export function Tray({ tray, hiddenTileIds }: Props) {
  useLanguage();
  const colorFriendly = useSettings(s => s.colorFriendly);
  const slots = Array.from({ length: TRAY_SIZE }, (_, i) => tray[i]);
  // Where each tile sat on the previous render, to slide it from there.
  const previous = useRef(new Map<number, number>());
  const before = previous.current;
  useEffect(() => {
    previous.current = new Map(tray.map((placed, i) => [placed.id, i]));
  });
  return (
    <View
      testID="tray"
      accessible
      accessibilityLabel={t('game.tray', {
        count: tray.length,
        size: TRAY_SIZE,
      })}
      style={styles.tray}
    >
      {slots.map((tile, i) => (
        <View key={i} style={styles.slot} testID={`tray-slot-${i}`}>
          {tile && !hiddenTileIds?.has(tile.id) ? (
            <TrayTile
              key={tile.id}
              tile={tile}
              slot={i}
              from={before.get(tile.id)}
              badge={colorFriendly}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    flexDirection: 'row',
    gap: TRAY_SLOT_GAP,
    // The frame is drawn inside the padding so slot positions stay exact.
    borderWidth: TRAY_FRAME,
    padding: TRAY_PADDING - TRAY_FRAME,
    borderColor: colors.trayFrame,
    borderRadius: radius.sm,
    backgroundColor: colors.tray,
    shadowColor: '#5B4630',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.42,
    shadowRadius: 2,
    elevation: 5,
  },
  slot: {
    width: TRAY_SLOT_WIDTH,
    height: TRAY_SLOT_HEIGHT,
    borderRadius: radius.sm,
    backgroundColor: colors.traySlot,
    borderWidth: 1,
    borderColor: '#484235',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Same look as a board tile, so the tile keeps its face when it lands.
  face: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tileFace,
    borderWidth: 1,
    borderColor: colors.tileEdge,
    borderBottomWidth: 4,
    borderRadius: radius.sm,
  },
  glyph: { fontSize: 20 },
});
