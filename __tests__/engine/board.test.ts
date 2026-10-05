import { getFreeTiles, isFree, overlaps } from '@engine/core/board';
import { tile } from './helpers';

describe('board', () => {
  it('detects overlap with half-cell offsets', () => {
    expect(overlaps(tile(1, 1, 0, 0), tile(2, 1, 0.5, 0.5))).toBe(true);
    expect(overlaps(tile(1, 1, 0, 0), tile(2, 1, 1, 0))).toBe(false);
    expect(overlaps(tile(1, 1, 0, 0), tile(2, 1, 0, 1))).toBe(false);
  });

  it('a tile under an overlapping higher tile is blocked', () => {
    const bottom = tile(1, 1, 0, 0, 0);
    const top = tile(2, 1, 0.5, 0, 1);
    const board = [bottom, top];
    expect(isFree(bottom, board)).toBe(false);
    expect(isFree(top, board)).toBe(true);
  });

  it('non-overlapping and lower tiles do not block', () => {
    const a = tile(1, 1, 0, 0, 1);
    const b = tile(2, 1, 0.5, 0, 0);
    const far = tile(3, 1, 5, 5, 2);
    expect(isFree(a, [a, b, far])).toBe(true);
    expect(isFree(b, [a, b, far])).toBe(false);
    expect(isFree(far, [a, b, far])).toBe(true);
  });

  it('getFreeTiles returns only free tiles', () => {
    const board = [tile(1, 1, 0, 0, 0), tile(2, 1, 0, 0, 1), tile(3, 1, 4, 0)];
    expect(getFreeTiles(board).map(t => t.id)).toEqual([2, 3]);
  });
});
