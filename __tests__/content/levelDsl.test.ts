import { GameEngine, parseLevelData } from '@engine';
import { buildLevel, select, tap } from '@services/levels/levelDsl';

describe('buildLevel', () => {
  it('turns letters into tile types and counts every non-empty cell', () => {
    const level = buildLevel({
      levelId: 3,
      slack: 3,
      layers: [{ rows: ['AAA', 'BBB'] }],
    });
    expect(level.tiles).toHaveLength(6);
    expect(level.tiles.map(t => t.typeId)).toEqual([1, 1, 1, 2, 2, 2]);
    expect(level.tiles.map(t => t.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(level.levelId).toBe(3);
    expect(level.validatedSlack).toBe(3);
    expect(level.tutorial).toBeUndefined();
  });

  it('centres the drawing horizontally and keeps cells one apart', () => {
    const level = buildLevel({
      levelId: 1,
      slack: 3,
      layers: [{ rows: ['AAAB', 'BBBA'] }],
    });
    const first = level.tiles[0]!;
    expect(first.x).toBe(2); // (8 - 4 columns) / 2
    expect(level.tiles[1]!.x - first.x).toBe(1);
    expect(level.tiles[4]!.y - first.y).toBe(1);
  });

  it('skips "." and spaces', () => {
    const level = buildLevel({
      levelId: 1,
      slack: 3,
      layers: [{ rows: ['A.A', ' A.', 'A..'] }],
    });
    expect(level.tiles).toHaveLength(4);
  });

  it('puts upper layers on top, shifted by their half-cell offset', () => {
    const level = buildLevel({
      levelId: 1,
      slack: 3,
      layers: [{ rows: ['AAA'] }, { rows: ['A.A'], dx: 0.5, dy: 0.5 }],
    });
    const base = level.tiles.filter(t => t.layer === 0);
    const top = level.tiles.filter(t => t.layer === 1);
    expect(base).toHaveLength(3);
    expect(top).toHaveLength(2);
    expect(top[0]!.x).toBe(base[0]!.x + 0.5);
    expect(top[0]!.y).toBe(base[0]!.y + 0.5);
  });

  it('sets star thresholds from the tile count', () => {
    const level = buildLevel({
      levelId: 1,
      slack: 3,
      layers: [{ rows: ['AAA', 'BBB'] }],
    });
    // 6 tiles: reference 60 + 200 = 260 -> 312 / 416.
    expect(level.twoStarScore).toBe(312);
    expect(level.threeStarScore).toBe(416);
  });

  it('resolves steps by (layer, row, column) into tile ids', () => {
    const level = buildLevel({
      levelId: 1,
      slack: 3,
      layers: [{ rows: ['AAA', 'BBB'] }],
      steps: at => [select('k.one', at(0, 1, 2)), tap('k.two', at(0, 0, 0))],
    });
    expect(level.tutorial).toEqual([
      { messageKey: 'k.one', waitFor: 'select', highlightTileIds: [6] },
      { messageKey: 'k.two', waitFor: 'tap', highlightTileIds: [1] },
    ]);
  });

  it('omits the tutorial field when the steps list is empty', () => {
    const level = buildLevel({
      levelId: 1,
      slack: 3,
      layers: [{ rows: ['AAA'] }],
      steps: () => [],
    });
    expect('tutorial' in level).toBe(false);
  });

  it('fails loudly for a step that points at an empty cell', () => {
    expect(() =>
      buildLevel({
        levelId: 9,
        slack: 3,
        layers: [{ rows: ['A.A'] }],
        steps: at => [select('k', at(0, 0, 1))],
      }),
    ).toThrow(/Level 9: no tile at layer 0, row 0, column 1/);
  });

  it('rejects characters that are not a tile type', () => {
    expect(() =>
      buildLevel({ levelId: 2, slack: 3, layers: [{ rows: ['A1A'] }] }),
    ).toThrow(/bad cell "1"/);
  });

  it('produces a level the engine and parser accept', () => {
    const level = buildLevel({
      levelId: 1,
      slack: 3,
      layers: [{ rows: ['AAA', 'BBB'] }],
      steps: at => [select('k', at(0, 0, 0))],
    });
    expect(() => new GameEngine(level)).not.toThrow();
    expect(parseLevelData(JSON.parse(JSON.stringify(level)))).toEqual(level);
  });
});
