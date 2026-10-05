import {
  AuthoredLevelSource,
  CompositeLevelSource,
  GeneratedLevelSource,
  LevelDataError,
  LevelNotFoundError,
  generateLevel,
} from '@engine';

const authored = (levels: Record<number, unknown>) =>
  new AuthoredLevelSource(async id => levels[id]);

describe('AuthoredLevelSource', () => {
  it('loads and parses a level by id', async () => {
    const raw = JSON.parse(JSON.stringify(generateLevel(3)));
    await expect(authored({ 3: raw }).getLevel(3)).resolves.toEqual(
      generateLevel(3),
    );
  });

  it('throws LevelNotFoundError when the loader has nothing', async () => {
    await expect(authored({}).getLevel(9)).rejects.toBeInstanceOf(
      LevelNotFoundError,
    );
    const nulls = new AuthoredLevelSource(async () => null);
    await expect(nulls.getLevel(9)).rejects.toBeInstanceOf(LevelNotFoundError);
  });

  it('rejects data for a different level id', async () => {
    const raw = JSON.parse(JSON.stringify(generateLevel(3)));
    await expect(authored({ 4: raw }).getLevel(4)).rejects.toThrow(
      LevelDataError,
    );
  });

  it('rejects malformed data', async () => {
    await expect(
      authored({ 1: { nope: true } }).getLevel(1),
    ).rejects.toBeInstanceOf(LevelDataError);
  });
});

describe('GeneratedLevelSource', () => {
  it('generates the same level as generateLevel', async () => {
    const source = new GeneratedLevelSource({ baseSeed: 4 });
    await expect(source.getLevel(12)).resolves.toEqual(
      generateLevel(12, { baseSeed: 4 }),
    );
  });

  it('serves repeat requests from the cache', async () => {
    const source = new GeneratedLevelSource();
    expect(await source.getLevel(5)).toBe(await source.getLevel(5));
  });

  it('evicts the least recently used level when full', async () => {
    const source = new GeneratedLevelSource({}, 2);
    const first = await source.getLevel(1);
    const second = await source.getLevel(2);
    await source.getLevel(1); // refresh 1, so 2 is now the oldest
    await source.getLevel(3); // evicts 2
    expect(await source.getLevel(1)).toBe(first);
    const again = await source.getLevel(2);
    expect(again).not.toBe(second);
    expect(again).toEqual(second);
  });

  it('keeps working past the cache size', async () => {
    const source = new GeneratedLevelSource({}, 3);
    for (let id = 1; id <= 20; id++) {
      await source.getLevel(id);
    }
    expect(await source.getLevel(1)).toEqual(generateLevel(1));
  });
});

describe('CompositeLevelSource', () => {
  it('prefers the first source that has the level', async () => {
    const raw = JSON.parse(JSON.stringify(generateLevel(2, { baseSeed: 99 })));
    const source = new CompositeLevelSource([
      authored({ 2: raw }),
      new GeneratedLevelSource(),
    ]);
    expect((await source.getLevel(2)).tiles).toEqual(
      generateLevel(2, { baseSeed: 99 }).tiles,
    );
  });

  it('falls back to the next source when a level is missing', async () => {
    const source = new CompositeLevelSource([
      authored({}),
      new GeneratedLevelSource(),
    ]);
    await expect(source.getLevel(7)).resolves.toEqual(generateLevel(7));
  });

  it('propagates real errors instead of hiding them', async () => {
    const source = new CompositeLevelSource([
      authored({ 1: { broken: true } }),
      new GeneratedLevelSource(),
    ]);
    await expect(source.getLevel(1)).rejects.toBeInstanceOf(LevelDataError);
  });

  it('throws LevelNotFoundError when no source has the level', async () => {
    const source = new CompositeLevelSource([authored({})]);
    await expect(source.getLevel(1)).rejects.toBeInstanceOf(LevelNotFoundError);
  });
});
