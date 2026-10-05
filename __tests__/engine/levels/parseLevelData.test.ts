import { LevelDataError, generateLevel, parseLevelData } from '@engine';

const valid = () => JSON.parse(JSON.stringify(generateLevel(3)));

describe('parseLevelData', () => {
  it('round-trips a level through JSON', () => {
    const level = generateLevel(25);
    expect(parseLevelData(JSON.parse(JSON.stringify(level)))).toEqual(level);
  });

  it('keeps optional fields when present', () => {
    const raw = { ...valid(), noBoosters: true, themeId: 'forest' };
    expect(parseLevelData(raw)).toMatchObject({
      noBoosters: true,
      themeId: 'forest',
    });
  });

  it.each([
    ['not an object', 'nope'],
    ['an array', []],
    ['null', null],
  ])('rejects %s', (_name, raw) => {
    expect(() => parseLevelData(raw)).toThrow(LevelDataError);
  });

  it('rejects an unsupported schemaVersion', () => {
    expect(() => parseLevelData({ ...valid(), schemaVersion: 99 })).toThrow(
      /Unsupported schemaVersion 99/,
    );
  });

  it('rejects missing or non-numeric fields', () => {
    const withoutId = valid();
    delete withoutId.levelId;
    expect(() => parseLevelData(withoutId)).toThrow(/levelId/);
    expect(() => parseLevelData({ ...valid(), twoStarScore: '5' })).toThrow(
      /twoStarScore/,
    );
    expect(() => parseLevelData({ ...valid(), validatedSlack: NaN })).toThrow(
      /validatedSlack/,
    );
  });

  it('rejects malformed tiles', () => {
    expect(() => parseLevelData({ ...valid(), tiles: 'x' })).toThrow(
      /tiles must/,
    );
    expect(() => parseLevelData({ ...valid(), tiles: [5] })).toThrow(
      /tiles\[0\]/,
    );
    const raw = valid();
    raw.tiles[2].x = 'left';
    expect(() => parseLevelData(raw)).toThrow(/tiles\[2\]\.x/);
  });

  it('rejects wrongly typed optional fields', () => {
    expect(() => parseLevelData({ ...valid(), themeId: 3 })).toThrow(/themeId/);
    expect(() => parseLevelData({ ...valid(), noBoosters: 'yes' })).toThrow(
      /noBoosters/,
    );
  });

  it('rejects star thresholds in the wrong order', () => {
    expect(() =>
      parseLevelData({ ...valid(), twoStarScore: 900, threeStarScore: 100 }),
    ).toThrow(/threeStarScore/);
  });

  it('rejects levels that break the game rules', () => {
    const raw = valid();
    raw.tiles.pop();
    expect(() => parseLevelData(raw)).toThrow(LevelDataError);
    expect(() => parseLevelData({ ...valid(), tiles: [] })).toThrow(/no tiles/);
  });
});

describe('parseLevelData tutorial steps', () => {
  const withSteps = (tutorial: unknown) => ({ ...valid(), tutorial });
  const someIds = () =>
    valid()
      .tiles.slice(0, 2)
      .map((t: { id: number }) => t.id);

  it('accepts and copies valid steps', () => {
    const [a, b] = someIds();
    const level = parseLevelData(
      withSteps([
        { messageKey: 'k.one', waitFor: 'select', highlightTileIds: [a] },
        { messageKey: 'k.two', waitFor: 'tap', highlightTileIds: [] },
        { messageKey: 'k.three', waitFor: 'tap', highlightTileIds: [a, b] },
      ]),
    );
    expect(level.tutorial).toEqual([
      { messageKey: 'k.one', waitFor: 'select', highlightTileIds: [a] },
      { messageKey: 'k.two', waitFor: 'tap', highlightTileIds: [] },
      { messageKey: 'k.three', waitFor: 'tap', highlightTileIds: [a, b] },
    ]);
  });

  it('leaves normal levels without a tutorial', () => {
    expect(parseLevelData(valid()).tutorial).toBeUndefined();
  });

  it('accepts an empty list', () => {
    expect(parseLevelData(withSteps([])).tutorial).toEqual([]);
  });

  it.each([
    ['not an array', 'steps', /tutorial must be an array/],
    ['a step that is not an object', [5], /tutorial\[0\] must be an object/],
    ['a missing key', [{ waitFor: 'tap', highlightTileIds: [] }], /messageKey/],
    [
      'an empty key',
      [{ messageKey: '', waitFor: 'tap', highlightTileIds: [] }],
      /messageKey/,
    ],
    [
      'an unknown waitFor',
      [{ messageKey: 'k', waitFor: 'swipe', highlightTileIds: [] }],
      /waitFor/,
    ],
    [
      'highlights that are not numbers',
      [{ messageKey: 'k', waitFor: 'tap', highlightTileIds: ['1'] }],
      /highlightTileIds/,
    ],
    [
      'highlights that are not an array',
      [{ messageKey: 'k', waitFor: 'tap', highlightTileIds: 3 }],
      /highlightTileIds/,
    ],
    [
      'a select step with nothing to select',
      [{ messageKey: 'k', waitFor: 'select', highlightTileIds: [] }],
      /highlights none/,
    ],
    [
      'a highlight on a tile that does not exist',
      [{ messageKey: 'k', waitFor: 'tap', highlightTileIds: [99999] }],
      /unknown tile 99999/,
    ],
  ])('rejects %s', (_name, tutorial, message) => {
    expect(() => parseLevelData(withSteps(tutorial))).toThrow(LevelDataError);
    expect(() => parseLevelData(withSteps(tutorial))).toThrow(message);
  });
});
