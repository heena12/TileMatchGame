import { getDifficultyConfig } from '@engine';

describe('getDifficultyConfig', () => {
  it.each([
    [1, 'tutorial'],
    [10, 'tutorial'],
    [11, 'easy'],
    [30, 'easy'],
    [31, 'medium'],
    [120, 'medium'],
    [121, 'hard'],
    [500, 'hard'],
    [501, 'expert'],
    [10000, 'expert'],
    [25000, 'expert'],
  ])('level %i is %s', (id, tier) => {
    expect(getDifficultyConfig(id).tier).toBe(tier);
  });

  it('starts and ends the tutorial at the documented sizes', () => {
    expect(getDifficultyConfig(1)).toMatchObject({
      typeCount: 3,
      tileCount: 18,
      layerCount: 1,
      requiredSlack: 3,
    });
    expect(getDifficultyConfig(10)).toMatchObject({
      typeCount: 4,
      tileCount: 30,
      layerCount: 2,
    });
  });

  it('uses the slack from the design per tier', () => {
    expect(getDifficultyConfig(5).requiredSlack).toBe(3);
    expect(getDifficultyConfig(20).requiredSlack).toBe(2);
    expect(getDifficultyConfig(100).requiredSlack).toBe(1);
    expect(getDifficultyConfig(300).requiredSlack).toBe(1);
    expect(getDifficultyConfig(5000).requiredSlack).toBe(0);
  });

  it('makes every 10th expert level a boss with the maximum type count', () => {
    expect(getDifficultyConfig(510)).toMatchObject({
      isBoss: true,
      typeCount: 20,
    });
    expect(getDifficultyConfig(10000).isBoss).toBe(true);
    expect(getDifficultyConfig(511).isBoss).toBe(false);
    expect(getDifficultyConfig(400).isBoss).toBe(false);
  });

  it('keeps tiles a multiple of 3 and at least 3 per type for every level', () => {
    for (let id = 1; id <= 10000; id += 7) {
      const c = getDifficultyConfig(id);
      expect(c.tileCount % 3).toBe(0);
      expect(c.tileCount).toBeGreaterThanOrEqual(c.typeCount * 3);
      expect(c.tileCount).toBeLessThanOrEqual(150);
      expect(c.typeCount).toBeLessThanOrEqual(20);
      expect(c.layerCount).toBeGreaterThanOrEqual(1);
      expect(c.layerCount).toBeLessThanOrEqual(6);
      expect(c.overlapDensity).toBeGreaterThanOrEqual(0);
      expect(c.overlapDensity).toBeLessThanOrEqual(1);
    }
  });

  it('never gets easier within a tier', () => {
    expect(getDifficultyConfig(30).tileCount).toBeGreaterThanOrEqual(
      getDifficultyConfig(12).tileCount,
    );
    expect(getDifficultyConfig(3000).tileCount).toBeGreaterThanOrEqual(
      getDifficultyConfig(600).tileCount,
    );
  });

  it('makes level 17 clearly harder than before: more pictures, tiles and layers', () => {
    expect(getDifficultyConfig(17)).toMatchObject({
      typeCount: 6,
      tileCount: 48,
      layerCount: 3,
    });
  });

  it.each([0, -3, 1.5, NaN])('rejects invalid level id %p', id => {
    expect(() => getDifficultyConfig(id)).toThrow(RangeError);
  });
});
