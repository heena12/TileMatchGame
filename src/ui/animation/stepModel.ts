import type { Tile } from '@engine';
import type { StepRecord } from '@state/gameSessionStore';
import { tileRect } from '@ui/game/boardLayout';
import { traySlotRect } from '@ui/game/trayMetrics';
import type { Rect } from '@ui/game/trayMetrics';

/** Where the board and the tray sit, in the coordinates of the play area. */
export interface Geometry {
  readonly board: {
    readonly left: number;
    readonly top: number;
    readonly cell: number;
    /** Logical cell drawn at the board's top-left; 0 when the whole board shows. */
    readonly originX?: number;
    readonly originY?: number;
  };
  readonly tray: { readonly left: number; readonly top: number };
}

export interface FlightPlan {
  readonly key: string;
  readonly tileId: number;
  readonly typeId: number;
  readonly from: Rect;
  readonly to: Rect;
}

export interface BurstPlan {
  readonly key: string;
  /** A combo: the match gets a crown and confetti as well as paper shards. */
  readonly crown: boolean;
  readonly typeId: number;
  readonly rects: readonly Rect[];
}

export interface FlashPlan {
  readonly key: string;
  readonly rect: Rect;
}

/** Everything one step wants drawn. Pure data, so it can be tested without rendering. */
export interface AnimationPlan {
  readonly flights: readonly FlightPlan[];
  readonly bursts: readonly BurstPlan[];
  readonly flashes: readonly FlashPlan[];
}

export const EMPTY_PLAN: AnimationPlan = {
  flights: [],
  bursts: [],
  flashes: [],
};

export function isEmptyPlan(plan: AnimationPlan): boolean {
  return (
    plan.flights.length === 0 &&
    plan.bursts.length === 0 &&
    plan.flashes.length === 0
  );
}

export function boardTileRect(
  tile: Pick<Tile, 'x' | 'y' | 'layer'>,
  board: Geometry['board'],
): Rect {
  const r = tileRect(tile, board.cell, {
    x: board.originX ?? 0,
    y: board.originY ?? 0,
  });
  return {
    left: board.left + r.left,
    top: board.top + r.top,
    width: r.size,
    height: r.size,
  };
}

/**
 * Turns one step into visuals:
 * - a selected tile flies from its board spot to its tray slot;
 * - a match pops the three tiles where they were sitting in the tray;
 * - a rejected tap flashes the tile it referred to.
 */
export function planStep(step: StepRecord, geometry: Geometry): AnimationPlan {
  const { seq, events, tile, trayBefore } = step;

  if (events.some(e => e.type === 'COMMAND_REJECTED')) {
    return tile
      ? {
          ...EMPTY_PLAN,
          flashes: [
            { key: `${seq}-flash`, rect: boardTileRect(tile, geometry.board) },
          ],
        }
      : EMPTY_PLAN;
  }

  const selected = events.find(e => e.type === 'TILE_SELECTED');
  if (!tile || !selected || selected.type !== 'TILE_SELECTED') {
    return EMPTY_PLAN;
  }

  const flights: FlightPlan[] = [
    {
      key: `${seq}-flight`,
      tileId: tile.id,
      typeId: tile.typeId,
      from: boardTileRect(tile, geometry.board),
      to: traySlotRect(geometry.tray, selected.trayIndex),
    },
  ];

  const bursts: BurstPlan[] = [];
  const matched = events.find(e => e.type === 'TILES_MATCHED');
  if (matched && matched.type === 'TILES_MATCHED') {
    // The tray as it looked right after insertion, before the match removed tiles.
    const inserted = [...trayBefore];
    inserted.splice(selected.trayIndex, 0, tile);
    const rects = matched.tileIds
      .map(id => inserted.findIndex(t => t.id === id))
      .filter(index => index >= 0)
      .map(index => traySlotRect(geometry.tray, index));
    bursts.push({
      key: `${seq}-burst`,
      crown: (step.comboLevel ?? 0) > 0,
      typeId: matched.typeId,
      rects,
    });
  }

  return { flights, bursts, flashes: [] };
}
