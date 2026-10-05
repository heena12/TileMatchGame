import type { GameEvent, Tile } from '@engine';
import type { StepRecord } from '@state/gameSessionStore';
import { boardTileRect, planStep } from '@ui/animation/stepModel';
import type { Geometry } from '@ui/animation/stepModel';
import { LAYER_LIFT } from '@ui/game/boardLayout';
import {
  TRAY_PADDING,
  TRAY_SLOT_GAP,
  TRAY_SLOT_HEIGHT,
  TRAY_SLOT_WIDTH,
  traySlotRect,
} from '@ui/game/trayMetrics';

const geometry: Geometry = {
  board: { left: 20, top: 100, cell: 40 },
  tray: { left: 10, top: 700 },
};

const tile = (id: number, typeId: number, x = 0, y = 0, layer = 0): Tile => ({
  id,
  typeId,
  x,
  y,
  layer,
});

const step = (
  events: GameEvent[],
  t: Tile | null,
  trayBefore: Tile[] = [],
  seq = 5,
): StepRecord => ({ seq, events, tile: t, trayBefore });

const selected = (
  tileId: number,
  typeId: number,
  trayIndex: number,
): GameEvent => ({
  type: 'TILE_SELECTED',
  tileId,
  typeId,
  trayIndex,
});

describe('traySlotRect', () => {
  it('places slots left to right inside the tray padding', () => {
    expect(traySlotRect({ left: 10, top: 700 }, 0)).toEqual({
      left: 10 + TRAY_PADDING,
      top: 700 + TRAY_PADDING,
      width: TRAY_SLOT_WIDTH,
      height: TRAY_SLOT_HEIGHT,
    });
    expect(traySlotRect({ left: 0, top: 0 }, 3).left).toBe(
      TRAY_PADDING + 3 * (TRAY_SLOT_WIDTH + TRAY_SLOT_GAP),
    );
  });
});

describe('boardTileRect', () => {
  it('offsets a tile by the board origin and lifts it by layer', () => {
    expect(boardTileRect({ x: 2, y: 1, layer: 0 }, geometry.board)).toEqual({
      left: 20 + 80,
      top: 100 + 40,
      width: 40,
      height: 40,
    });
    expect(boardTileRect({ x: 0, y: 0, layer: 2 }, geometry.board).top).toBe(
      100 - 2 * LAYER_LIFT,
    );
  });
});

describe('planStep', () => {
  it('plans a flight from the tile to its tray slot', () => {
    const t = tile(7, 3, 4, 2);
    const plan = planStep(
      step([selected(7, 3, 2)], t, [tile(1, 1), tile(2, 2)]),
      geometry,
    );
    expect(plan.flights).toEqual([
      {
        key: '5-flight',
        tileId: 7,
        typeId: 3,
        from: boardTileRect(t, geometry.board),
        to: traySlotRect(geometry.tray, 2),
      },
    ]);
    expect(plan.bursts).toEqual([]);
    expect(plan.flashes).toEqual([]);
  });

  it('plans a burst at the slots the matched tiles occupied before removal', () => {
    // Tray had A B; a third A is inserted after the first A -> [A, A, B].
    const a1 = tile(1, 1);
    const b = tile(2, 2);
    const a2 = tile(3, 1);
    const a3 = tile(4, 1, 6, 6);
    const trayBefore = [a1, a2, b];
    // a3 slots in at index 2 (after the last A): [A, A, A, B].
    const plan = planStep(
      step(
        [
          selected(4, 1, 2),
          { type: 'TILES_MATCHED', typeId: 1, tileIds: [1, 3, 4] },
        ],
        a3,
        trayBefore,
      ),
      geometry,
    );
    expect(plan.bursts).toHaveLength(1);
    expect(plan.bursts[0]?.typeId).toBe(1);
    expect(plan.bursts[0]?.rects).toEqual([
      traySlotRect(geometry.tray, 0),
      traySlotRect(geometry.tray, 1),
      traySlotRect(geometry.tray, 2),
    ]);
  });

  it('adds the crown and confetti only for a combo', () => {
    const a1 = tile(1, 1);
    const a2 = tile(3, 1);
    const a3 = tile(4, 1, 6, 6);
    const events = [
      selected(4, 1, 2),
      { type: 'TILES_MATCHED' as const, typeId: 1, tileIds: [1, 3, 4] },
    ];
    const plain = planStep(step(events, a3, [a1, a2]), geometry);
    expect(plain.bursts[0]?.crown).toBe(false);
    const combo = planStep(
      { ...step(events, a3, [a1, a2]), comboLevel: 2 },
      geometry,
    );
    expect(combo.bursts[0]?.crown).toBe(true);
  });

  it('skips matched ids it cannot find in the tray', () => {
    const t = tile(4, 1);
    const plan = planStep(
      step(
        [
          selected(4, 1, 0),
          { type: 'TILES_MATCHED', typeId: 1, tileIds: [4, 98, 99] },
        ],
        t,
      ),
      geometry,
    );
    expect(plan.bursts[0]?.rects).toHaveLength(1);
  });

  it('plans a flash on the tile for a rejected tap', () => {
    const t = tile(9, 1, 3, 3, 1);
    const plan = planStep(
      step([{ type: 'COMMAND_REJECTED', reason: 'TILE_BLOCKED' }], t),
      geometry,
    );
    expect(plan.flights).toEqual([]);
    expect(plan.flashes).toEqual([
      { key: '5-flash', rect: boardTileRect(t, geometry.board) },
    ]);
  });

  it('plans nothing for a rejected tap on an unknown tile', () => {
    const plan = planStep(
      step([{ type: 'COMMAND_REJECTED', reason: 'TILE_NOT_FOUND' }], null),
      geometry,
    );
    expect(plan).toEqual({ flights: [], bursts: [], flashes: [] });
  });

  it('plans nothing when the step has no selection to show', () => {
    expect(planStep(step([], tile(1, 1)), geometry)).toEqual({
      flights: [],
      bursts: [],
      flashes: [],
    });
    expect(planStep(step([selected(1, 1, 0)], null), geometry).flights).toEqual(
      [],
    );
  });

  it('uses the step seq in keys so effects never collide', () => {
    const t = tile(1, 1);
    const a = planStep(step([selected(1, 1, 0)], t, [], 1), geometry);
    const b = planStep(step([selected(1, 1, 0)], t, [], 2), geometry);
    expect(a.flights[0]?.key).not.toBe(b.flights[0]?.key);
  });
});
