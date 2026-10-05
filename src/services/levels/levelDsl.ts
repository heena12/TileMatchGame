import { LEVEL_SCHEMA_VERSION, defaultThresholds } from '@engine';
import type { LevelData, TileSpec, TutorialStep } from '@engine';

/**
 * A layer drawn as text. One character per cell: a letter is a tile type
 * (A = type 1, B = type 2, ...), "." or a space is empty. `dx` / `dy` shift
 * the whole layer by half cells so it straddles the layer below.
 */
export interface LayerSpec {
  readonly rows: readonly string[];
  readonly dx?: number;
  readonly dy?: number;
}

/** Finds the id of the tile drawn at (layer, row, column). Throws if the cell is empty. */
export type TileLocator = (layer: number, row: number, col: number) => number;

export interface LevelSpec {
  readonly levelId: number;
  readonly layers: readonly LayerSpec[];
  /** Spare tray slots the level is verified for. */
  readonly slack: number;
  readonly steps?: (at: TileLocator) => TutorialStep[];
  readonly themeId?: string;
}

const BOARD_COLUMNS = 8;
/** First grid row, so short layouts sit near the vertical middle of the board. */
const TOP_ROW = 3;

const isEmpty = (ch: string) => ch === '.' || ch === ' ';

/** A step that waits for the player to tap one of the given tiles. */
export function select(messageKey: string, ...tileIds: number[]): TutorialStep {
  return { messageKey, waitFor: 'select', highlightTileIds: tileIds };
}

/** A step that shows a message and waits for "Got it". */
export function tap(messageKey: string, ...tileIds: number[]): TutorialStep {
  return { messageKey, waitFor: 'tap', highlightTileIds: tileIds };
}

export function buildLevel(spec: LevelSpec): LevelData {
  const columns = Math.max(
    ...spec.layers.flatMap(l => l.rows.map(r => r.length)),
  );
  const left = (BOARD_COLUMNS - columns) / 2;

  const tiles: TileSpec[] = [];
  const ids = new Map<string, number>();
  spec.layers.forEach((layer, layerIndex) => {
    layer.rows.forEach((row, rowIndex) => {
      [...row].forEach((ch, colIndex) => {
        if (isEmpty(ch)) {
          return;
        }
        if (ch < 'A' || ch > 'Z') {
          throw new Error(`Level ${spec.levelId}: bad cell "${ch}"`);
        }
        const id = tiles.length + 1;
        ids.set(`${layerIndex}:${rowIndex}:${colIndex}`, id);
        tiles.push({
          id,
          typeId: ch.charCodeAt(0) - 64,
          x: left + colIndex + (layer.dx ?? 0),
          y: TOP_ROW + rowIndex + (layer.dy ?? 0),
          layer: layerIndex,
        });
      });
    });
  });

  const at: TileLocator = (layer, row, col) => {
    const id = ids.get(`${layer}:${row}:${col}`);
    if (id === undefined) {
      throw new Error(
        `Level ${spec.levelId}: no tile at layer ${layer}, row ${row}, column ${col}`,
      );
    }
    return id;
  };

  const thresholds = defaultThresholds(tiles.length);
  const tutorial = spec.steps?.(at);
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    levelId: spec.levelId,
    themeId: spec.themeId ?? 'theme-0',
    tiles,
    twoStarScore: thresholds.twoStarScore,
    threeStarScore: thresholds.threeStarScore,
    validatedSlack: spec.slack,
    ...(tutorial && tutorial.length > 0 ? { tutorial } : {}),
  };
}
