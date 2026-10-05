import { puzzleBonusFor, puzzlePiecesRevealed } from '@state/puzzle';

describe('puzzlePiecesRevealed', () => {
  it('reveals one more piece per level, then starts a new picture', () => {
    expect([1, 2, 3, 4, 5, 6].map(puzzlePiecesRevealed)).toEqual([
      1, 2, 3, 4, 1, 2,
    ]);
  });
  it('treats level 0 or below as the first piece', () => {
    expect(puzzlePiecesRevealed(0)).toBe(1);
  });
  it('pays the bonus only on the first clear of the last piece', () => {
    expect(puzzleBonusFor(4, true)).toBe(150);
    expect(puzzleBonusFor(4, false)).toBe(0);
    expect(puzzleBonusFor(3, true)).toBe(0);
    expect(puzzleBonusFor(8, true)).toBe(150);
  });
});
