import { generateLevel, levelFingerprint } from '@engine';
import type { LevelData } from '@engine';

describe('levelFingerprint', () => {
  const base = () => generateLevel(120);

  it('is stable for the same level', () => {
    expect(levelFingerprint(base())).toBe(levelFingerprint(base()));
  });

  it('is an 8-character hex string', () => {
    expect(levelFingerprint(base())).toMatch(/^[0-9a-f]{8}$/);
  });

  it('survives a JSON round trip', () => {
    const level = base();
    const copy = JSON.parse(JSON.stringify(level)) as LevelData;
    expect(levelFingerprint(copy)).toBe(levelFingerprint(level));
  });

  it('differs between levels', () => {
    expect(levelFingerprint(generateLevel(120))).not.toBe(
      levelFingerprint(generateLevel(121)),
    );
  });

  it('changes when the level id changes', () => {
    const level = base();
    expect(levelFingerprint({ ...level, levelId: level.levelId + 1 })).not.toBe(
      levelFingerprint(level),
    );
  });

  it.each([
    [
      'a tile type',
      (t: LevelData['tiles'][number]) => ({ ...t, typeId: t.typeId + 1 }),
    ],
    [
      'a tile column',
      (t: LevelData['tiles'][number]) => ({ ...t, x: t.x + 0.5 }),
    ],
    ['a tile row', (t: LevelData['tiles'][number]) => ({ ...t, y: t.y + 0.5 })],
    [
      'a tile layer',
      (t: LevelData['tiles'][number]) => ({ ...t, layer: t.layer + 1 }),
    ],
    [
      'a tile id',
      (t: LevelData['tiles'][number]) => ({ ...t, id: t.id + 1000 }),
    ],
  ])('changes when %s changes', (_name, edit) => {
    const level = base();
    const tiles = level.tiles.map((t, i) => (i === 3 ? edit(t) : t));
    expect(levelFingerprint({ ...level, tiles })).not.toBe(
      levelFingerprint(level),
    );
  });

  it('changes when a tile is removed', () => {
    const level = base();
    expect(
      levelFingerprint({ ...level, tiles: level.tiles.slice(0, -1) }),
    ).not.toBe(levelFingerprint(level));
  });

  it('ignores things that do not change how the board plays', () => {
    const level = base();
    const same: LevelData = {
      ...level,
      twoStarScore: level.twoStarScore + 1,
      threeStarScore: level.threeStarScore + 1,
      themeId: 'other-theme',
      tutorial: [{ messageKey: 'k', waitFor: 'tap', highlightTileIds: [] }],
    };
    expect(levelFingerprint(same)).toBe(levelFingerprint(level));
  });

  it('tells apart the tile order that matters (swapped positions)', () => {
    const level = base();
    const tiles = [...level.tiles];
    const a = tiles[0]!;
    const b = tiles[1]!;
    tiles[0] = { ...a, x: b.x, y: b.y, layer: b.layer };
    tiles[1] = { ...b, x: a.x, y: a.y, layer: a.layer };
    expect(levelFingerprint({ ...level, tiles })).not.toBe(
      levelFingerprint(level),
    );
  });
});
