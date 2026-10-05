import { calculateReward } from '@engine/scoring/RewardSystem';

describe('RewardSystem', () => {
  it('pays nothing for a loss', () => {
    expect(calculateReward(0, 0)).toEqual({
      stars: 0,
      coins: 0,
      improved: false,
    });
  });

  it('first clear pays 10 + 5 per star', () => {
    expect(calculateReward(1, 0).coins).toBe(15);
    expect(calculateReward(2, 0).coins).toBe(20);
    expect(calculateReward(3, 0)).toEqual({
      stars: 3,
      coins: 25,
      improved: true,
    });
  });

  it('a replay that improves stars pays 5 per extra star', () => {
    expect(calculateReward(2, 1).coins).toBe(5);
    expect(calculateReward(3, 1).coins).toBe(10);
    expect(calculateReward(3, 2).coins).toBe(5);
  });

  it('a replay with the same or fewer stars pays nothing', () => {
    expect(calculateReward(2, 2)).toEqual({
      stars: 2,
      coins: 0,
      improved: false,
    });
    expect(calculateReward(1, 3).coins).toBe(0);
  });
});
