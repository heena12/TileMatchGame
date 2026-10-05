import {
  REGION_COUNT,
  levelForSlot,
  regionAt,
  regionIndexOf,
  slotState,
} from '../../src/config/regions';

describe('regions', () => {
  it('starts with France over levels 1-12 and Argentina over 13-80', () => {
    expect(regionAt(0)).toMatchObject({ name: 'France', first: 1, last: 12 });
    expect(regionAt(0).slots).toHaveLength(3);
    expect(regionAt(1)).toMatchObject({
      name: 'Argentina',
      first: 13,
      last: 80,
    });
    expect(regionAt(2)).toMatchObject({ name: 'Sweden', first: 81, last: 160 });
    expect(regionAt(3).name).toBe('United States');
  });

  it('covers every level exactly once with five pictures per later country', () => {
    expect(regionAt(5).slots).toHaveLength(5);
    const slots = regionAt(2).slots;
    expect(slots[0]?.first).toBe(81);
    expect(slots[4]?.last).toBe(160);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i]?.first).toBe((slots[i - 1]?.last ?? 0) + 1);
    }
  });

  it('finds the country of any level, up to the last one', () => {
    expect(regionIndexOf(1)).toBe(0);
    expect(regionIndexOf(13)).toBe(1);
    expect(regionIndexOf(81)).toBe(2);
    expect(regionIndexOf(4001)).toBe(51);
    expect(regionAt(REGION_COUNT - 1).last).toBe(10000);
  });

  it('marks a picture done, current or locked from the highest unlocked level', () => {
    const slot = { first: 5, last: 8 };
    expect(slotState(slot, 9)).toBe('done');
    expect(slotState(slot, 6)).toBe('current');
    expect(slotState(slot, 4)).toBe('locked');
    expect(levelForSlot(slot, 6)).toBe(6);
    expect(levelForSlot(slot, 9)).toBe(5);
  });
});
