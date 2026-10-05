import type { Tile } from '@engine';
import { HARD_THRESHOLD, hardPercent, passPercent } from '@state/difficulty';

const tiles = (count: number, types: number, layers: number): Tile[] =>
  Array.from(
    { length: count },
    (_, id) =>
      ({ id, typeId: id % types, x: id, y: 0, layer: id % layers } as Tile),
  );

describe('hardPercent', () => {
  it('rises with tiles, variety and layers', () => {
    const easy = hardPercent(tiles(9, 3, 1));
    const medium = hardPercent(tiles(60, 10, 3));
    const hard = hardPercent(tiles(100, 12, 4));
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
  });

  it('stays within 15..95 and is repeatable', () => {
    expect(hardPercent([])).toBe(15);
    expect(hardPercent(tiles(1000, 100, 20))).toBe(95);
    expect(hardPercent(tiles(60, 10, 3))).toBe(hardPercent(tiles(60, 10, 3)));
  });

  it('keeps small levels below the popup threshold', () => {
    expect(hardPercent(tiles(9, 3, 1))).toBeLessThan(HARD_THRESHOLD);
  });
});

describe('passPercent', () => {
  it('is the opposite of how hard the level feels, kept between 3 and 85', () => {
    expect(passPercent(62)).toBe(38);
    expect(passPercent(95)).toBe(5);
    expect(passPercent(100)).toBe(3);
    expect(passPercent(10)).toBe(85);
  });
});
