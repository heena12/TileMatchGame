import { extractMatch, insertTile } from '@engine/core/tray';
import { tile } from './helpers';

describe('tray', () => {
  it('appends a tile of a new type at the end', () => {
    const tray = [tile(1, 1), tile(2, 2)];
    expect(insertTile(tray, tile(3, 3)).map(t => t.id)).toEqual([1, 2, 3]);
  });

  it('groups a tile next to the same type', () => {
    const tray = [tile(1, 1), tile(2, 2), tile(3, 3)];
    expect(insertTile(tray, tile(4, 1)).map(t => t.id)).toEqual([1, 4, 2, 3]);
  });

  it('inserts after the last tile of the same type', () => {
    const tray = [tile(1, 1), tile(2, 1), tile(3, 2)];
    expect(insertTile(tray, tile(4, 1)).map(t => t.id)).toEqual([1, 2, 4, 3]);
  });

  it('does not mutate the input tray', () => {
    const tray = [tile(1, 1)];
    insertTile(tray, tile(2, 1));
    expect(tray).toHaveLength(1);
  });

  it('extracts three of a kind and shifts the rest left', () => {
    const tray = [tile(1, 1), tile(2, 2), tile(3, 1), tile(4, 1), tile(5, 3)];
    const { tray: rest, matched } = extractMatch(tray);
    expect(matched.map(t => t.id)).toEqual([1, 3, 4]);
    expect(rest.map(t => t.id)).toEqual([2, 5]);
  });

  it('returns the tray unchanged when there is no match', () => {
    const tray = [tile(1, 1), tile(2, 1), tile(3, 2)];
    const result = extractMatch(tray);
    expect(result.matched).toEqual([]);
    expect(result.tray).toBe(tray);
  });
});
