import {
  calculateStars,
  defaultThresholds,
  referenceScore,
} from '@engine/scoring/StarSystem';
import type { StarThresholds } from '@engine/scoring/StarSystem';

const thresholds: StarThresholds = { twoStarScore: 500, threeStarScore: 800 };

describe('StarSystem', () => {
  it('gives 0 stars on a loss regardless of score', () => {
    expect(calculateStars({ won: false, score: 9999, thresholds })).toBe(0);
  });

  it('gives 1 star for a clear below the 2-star score', () => {
    expect(calculateStars({ won: true, score: 499, thresholds })).toBe(1);
  });

  it('gives 2 stars at the 2-star score', () => {
    expect(calculateStars({ won: true, score: 500, thresholds })).toBe(2);
    expect(calculateStars({ won: true, score: 799, thresholds })).toBe(2);
  });

  it('gives 3 stars at the 3-star score', () => {
    expect(calculateStars({ won: true, score: 800, thresholds })).toBe(3);
  });

  it('ignores boosters unless the level sets noBoosters', () => {
    expect(
      calculateStars({ won: true, score: 900, thresholds, boostersUsed: 2 }),
    ).toBe(3);
  });

  it('caps at 2 stars when noBoosters is set and a booster was used', () => {
    const strict = { ...thresholds, noBoosters: true };
    expect(
      calculateStars({
        won: true,
        score: 900,
        thresholds: strict,
        boostersUsed: 1,
      }),
    ).toBe(2);
    expect(calculateStars({ won: true, score: 900, thresholds: strict })).toBe(
      3,
    );
  });

  it('falls to 1 star when noBoosters caps it and the score is under 2-star', () => {
    const strict = { ...thresholds, noBoosters: true };
    expect(
      calculateStars({
        won: true,
        score: 300,
        thresholds: strict,
        boostersUsed: 1,
      }),
    ).toBe(1);
  });

  it('computes the reference score without combos or clear bonus', () => {
    expect(referenceScore(18)).toBe(18 * 10 + 6 * 100);
    expect(referenceScore(150)).toBe(1500 + 5000);
  });

  it('derives default thresholds at 120% and 160% of the reference', () => {
    expect(defaultThresholds(18)).toEqual({
      twoStarScore: 936,
      threeStarScore: 1248,
    });
  });

  it('rounds default thresholds up', () => {
    // ref(21) = 210 + 700 = 910; 120% = 1092; 160% = 1456.
    expect(defaultThresholds(21)).toEqual({
      twoStarScore: 1092,
      threeStarScore: 1456,
    });
  });
});
