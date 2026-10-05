import {
  initialCombo,
  registerMatch,
  registerMissedSelection,
} from '@engine/scoring/ComboSystem';

describe('ComboSystem.registerMatch', () => {
  it('first match has level 0 and no bonus', () => {
    const { combo, bonus } = registerMatch(initialCombo, 3);
    expect(bonus).toBe(0);
    expect(combo).toEqual({ level: 0, lastMatchSelection: 3 });
  });

  it('chains when the next match is 1 to 3 selections later', () => {
    const first = registerMatch(initialCombo, 3).combo;
    expect(registerMatch(first, 4).bonus).toBe(50);
    expect(registerMatch(first, 6).bonus).toBe(50);
  });

  it('does not chain when more than 3 selections later', () => {
    const first = registerMatch(initialCombo, 3).combo;
    const second = registerMatch(first, 7);
    expect(second.bonus).toBe(0);
    expect(second.combo.level).toBe(0);
  });

  it('bonus grows by 50 per chained match', () => {
    let combo = initialCombo;
    const bonuses: number[] = [];
    [3, 6, 9, 12].forEach(sel => {
      const r = registerMatch(combo, sel);
      combo = r.combo;
      bonuses.push(r.bonus);
    });
    expect(bonuses).toEqual([0, 50, 100, 150]);
  });

  it('caps the combo level at 5', () => {
    let combo = initialCombo;
    let last = 0;
    for (let i = 1; i <= 9; i++) {
      const r = registerMatch(combo, i * 3);
      combo = r.combo;
      last = r.bonus;
    }
    expect(combo.level).toBe(5);
    expect(last).toBe(250);
  });

  it('does not mutate the previous state', () => {
    const before = { level: 1, lastMatchSelection: 3 };
    registerMatch(before, 4);
    expect(before).toEqual({ level: 1, lastMatchSelection: 3 });
  });
});

describe('ComboSystem.registerMissedSelection', () => {
  const running = { level: 2, lastMatchSelection: 3 };

  it('keeps the combo for the first two misses', () => {
    expect(registerMissedSelection(running, 4)).toBe(running);
    expect(registerMissedSelection(running, 5)).toBe(running);
  });

  it('resets after 3 selections without a match', () => {
    expect(registerMissedSelection(running, 6)).toEqual(initialCombo);
  });

  it('does nothing when no combo window is open', () => {
    expect(registerMissedSelection(initialCombo, 10)).toBe(initialCombo);
  });
});
