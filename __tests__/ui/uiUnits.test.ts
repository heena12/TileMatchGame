import { generateLevel } from '@engine';
import {
  BOARD_COLUMNS,
  BOARD_ROWS,
  LAYER_LIFT,
  byDrawOrder,
  computeBoardMetrics,
  tileRect,
} from '@ui/game/boardLayout';
import { STRING_KEYS, t } from '@ui/i18n/strings';
import { TILE_ART_COUNT, getTileArt } from '@ui/theme/tileArt';
import { tile } from '../engine/helpers';

describe('i18n', () => {
  it('returns plain strings unchanged', () => {
    expect(t('home.play')).toBe('Play');
  });

  it('fills placeholders, including repeats and numbers', () => {
    expect(t('home.continue', { level: 12 })).toBe('Level 12');
    expect(t('game.tray', { count: 3, size: 7 })).toBe(
      'Tray, 3 of 7 slots used',
    );
  });

  it('leaves unknown placeholders visible instead of hiding them', () => {
    expect(t('home.coins', {})).toBe('Coins: {coins}');
  });

  it('has no empty strings', () => {
    STRING_KEYS.forEach(key => expect(t(key).length).toBeGreaterThan(0));
  });
});

describe('tile art', () => {
  it('covers all 30 base types with distinct glyphs and names', () => {
    expect(TILE_ART_COUNT).toBe(30);
    const glyphs = new Set<string>();
    const names = new Set<string>();
    for (let id = 1; id <= 30; id++) {
      glyphs.add(getTileArt(id).glyph);
      names.add(getTileArt(id).name);
    }
    expect(glyphs.size).toBe(30);
    expect(names.size).toBe(30);
  });

  it('wraps unexpected ids instead of crashing', () => {
    expect(getTileArt(31)).toEqual(getTileArt(1));
    expect(getTileArt(0)).toEqual(getTileArt(30));
    expect(getTileArt(-5)).toBeDefined();
  });

  it('every generated tile type has art', () => {
    generateLevel(2500).tiles.forEach(t2 =>
      expect(getTileArt(t2.typeId).glyph).toBeTruthy(),
    );
  });
});

describe('board layout', () => {
  it('fits the whole 8 x 10 board in the smaller dimension', () => {
    expect(computeBoardMetrics(400, 1000)).toEqual({
      cell: 50,
      width: 50 * BOARD_COLUMNS,
      height: 50 * BOARD_ROWS,
    });
    expect(computeBoardMetrics(1000, 300).cell).toBe(30);
  });

  it('never returns a zero-size cell', () => {
    expect(computeBoardMetrics(0, 0).cell).toBe(1);
  });

  it('places tiles by cell and lifts upper layers', () => {
    expect(tileRect({ x: 2, y: 3, layer: 0 }, 40)).toEqual({
      left: 80,
      top: 120,
      size: 40,
    });
    expect(tileRect({ x: 2.5, y: 3, layer: 2 }, 40)).toEqual({
      left: 100,
      top: 120 - 2 * LAYER_LIFT,
      size: 40,
    });
  });

  it('draws lower layers first, then by id', () => {
    const sorted = [
      tile(3, 1, 0, 0, 1),
      tile(2, 1, 1, 0, 0),
      tile(1, 1, 2, 0, 0),
    ].sort(byDrawOrder);
    expect(sorted.map(x => x.id)).toEqual([1, 2, 3]);
  });

  it('keeps every generated tile inside the board rectangle', () => {
    const { cell, width, height } = computeBoardMetrics(320, 400);
    generateLevel(9000).tiles.forEach(tl => {
      const r = tileRect(tl, cell);
      expect(r.left).toBeGreaterThanOrEqual(0);
      expect(r.left + r.size).toBeLessThanOrEqual(width);
      expect(r.top + r.size).toBeLessThanOrEqual(height);
    });
  });
});
