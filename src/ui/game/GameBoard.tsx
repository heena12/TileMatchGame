import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, View } from 'react-native';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { Tile } from '@engine';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  FULL_EXTENT,
  boardExtent,
  byDrawOrder,
  computeBoardMetrics,
} from './boardLayout';
import type { BoardExtent } from './boardLayout';
import { useSettings } from '@state/StoresContext';
import { useLanguage } from '@ui/i18n/useLanguage';
import { IntroGroup, TILE_INTRO_MS } from './IntroGroup';
import { TileView } from './TileView';

export interface BoardGeometry {
  /** Top-left of the 8 x 10 board in the coordinates of the board's parent. */
  readonly left: number;
  readonly top: number;
  readonly cell: number;
  /** Logical cell drawn at the top-left corner. */
  readonly originX: number;
  readonly originY: number;
}

interface Props {
  board: readonly Tile[];
  freeTileIds: readonly number[];
  onSelect: (tileId: number) => void;
  /** Reports where the board sits so animations can start and end in the right place. */
  onGeometry?: (geometry: BoardGeometry) => void;
}

/** Used until the first layout pass reports the real size. */
const FALLBACK_AREA = {
  x: 0,
  y: 0,
  width: BOARD_COLUMNS * 40,
  height: BOARD_ROWS * 40,
};

export function GameBoard({ board, freeTileIds, onSelect, onGeometry }: Props) {
  const [area, setArea] = useState(FALLBACK_AREA);
  // Tiles drop in when the level opens, all driven by this one value. A tile
  // that appears later (Undo) finds it already at 1 and just shows.
  const reduced = useReducedMotion();
  const contrast = useSettings(s => s.colorFriendly);
  const language = useLanguage();
  const introProgress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) {
      introProgress.value = withTiming(1, {
        duration: TILE_INTRO_MS,
        easing: Easing.linear,
      });
    }
  }, [introProgress, reduced]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { x, y, width, height } = event.nativeEvent.layout;
    if (width > 0 && height > 0) {
      setArea({ x, y, width, height });
    }
  }, []);

  // Grow-only box around every tile seen, so the board keeps one size while
  // tiles are removed and a small level is drawn large.
  const extentRef = useRef<BoardExtent | null>(null);
  const extent = useMemo(() => {
    const seen = boardExtent(board);
    const prev = extentRef.current;
    if (board.length === 0) {
      return prev ?? FULL_EXTENT;
    }
    if (prev === null) {
      extentRef.current = seen;
      return seen;
    }
    const x = Math.min(prev.x, seen.x);
    const y = Math.min(prev.y, seen.y);
    const columns = Math.min(
      BOARD_COLUMNS,
      Math.max(prev.x + prev.columns, seen.x + seen.columns) - x,
    );
    const rows = Math.min(
      BOARD_ROWS,
      Math.max(prev.y + prev.rows, seen.y + seen.rows) - y,
    );
    if (
      x === prev.x &&
      y === prev.y &&
      columns === prev.columns &&
      rows === prev.rows
    ) {
      return prev;
    }
    extentRef.current = { x, y, columns, rows };
    return extentRef.current;
  }, [board]);

  const metrics = useMemo(
    () =>
      computeBoardMetrics(area.width, area.height, extent.columns, extent.rows),
    [area, extent],
  );
  const ordered = useMemo(() => [...board].sort(byDrawOrder), [board]);
  const free = useMemo(() => new Set(freeTileIds), [freeTileIds]);
  // Tiles are grouped into bands (one layer, two rows) that drop in together.
  const groups = useMemo(() => {
    const byKey = new Map<
      string,
      { layer: number; band: number; tiles: Tile[] }
    >();
    for (const tile of ordered) {
      const band = Math.floor(tile.y / 2);
      const key = `${tile.layer}:${band}`;
      const group = byKey.get(key) ?? { layer: tile.layer, band, tiles: [] };
      group.tiles.push(tile);
      byKey.set(key, group);
    }
    return [...byKey.entries()];
  }, [ordered]);

  useEffect(() => {
    onGeometry?.({
      left: area.x + (area.width - metrics.width) / 2,
      top: area.y + (area.height - metrics.height) / 2,
      cell: metrics.cell,
      originX: extent.x,
      originY: extent.y,
    });
  }, [area, metrics, extent, onGeometry]);

  return (
    <View style={styles.area} onLayout={onLayout}>
      <View style={{ width: metrics.width, height: metrics.height }}>
        {groups.map(([key, group]) => (
          <IntroGroup
            key={key}
            progress={introProgress}
            delayMs={Math.min(group.layer * 90 + group.band * 60, 700)}
            layer={group.layer}
          >
            {group.tiles.map(tile => (
              <TileView
                key={tile.id}
                tile={tile}
                free={free.has(tile.id)}
                cell={metrics.cell}
                origin={extent}
                onSelect={onSelect}
                contrast={contrast}
                language={language}
              />
            ))}
          </IntroGroup>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
