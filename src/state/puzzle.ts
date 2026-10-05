export const PUZZLE_PIECES = 4;

/** Coins for revealing the last piece of a picture. */
export const PUZZLE_BONUS_COINS = 150;

/** Pieces revealed once `levelId` is cleared: 1..4, then the next picture starts over. */
export function puzzlePiecesRevealed(levelId: number): number {
  return ((Math.max(levelId, 1) - 1) % PUZZLE_PIECES) + 1;
}

/** Paid only the first time a level is cleared, so replays cannot farm it. */
export function puzzleBonusFor(levelId: number, firstClear: boolean): number {
  return firstClear && puzzlePiecesRevealed(levelId) === PUZZLE_PIECES
    ? PUZZLE_BONUS_COINS
    : 0;
}
