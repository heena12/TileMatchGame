import { countedValue, flyingCoinCount } from '../../src/ui/animation/CoinFly';

describe('coin fly', () => {
  it('flies no coins when nothing was earned, and caps big rewards', () => {
    expect(flyingCoinCount(0)).toBe(0);
    expect(flyingCoinCount(10)).toBe(4);
    expect(flyingCoinCount(150)).toBe(10);
    expect(flyingCoinCount(5000)).toBe(10);
  });

  it('counts from the old total to the new one as coins land', () => {
    expect(countedValue(300, 450, -10, 900)).toBe(300);
    expect(countedValue(300, 450, 450, 900)).toBe(375);
    expect(countedValue(300, 450, 900, 900)).toBe(450);
    expect(countedValue(300, 450, 5000, 900)).toBe(450);
  });
});
