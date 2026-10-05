import { DealError, dealTypes, randomRemovalOrder } from './dealing';
import { SeededRandom, shuffled } from './random';
import { MATCH_SIZE } from './rules';
import type { GameState, Tile } from './types';

/** Tiles of each type, as a map type -> count. */
function countByType(tiles: readonly Tile[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const t of tiles) {
    counts.set(t.typeId, (counts.get(t.typeId) ?? 0) + 1);
  }
  return counts;
}

/** Shuffling only changes something when at least two different pictures are left. */
export function canShuffleBoard(board: readonly Tile[]): boolean {
  return new Set(board.map(t => t.typeId)).size >= 2;
}

/**
 * Re-deals which picture sits on which tile, keeping every position, layer and
 * id and the number of tiles of each picture.
 *
 * The deal is not random noise: it follows a random valid order of taking the
 * tiles and hands out pictures so that the order is a winning play, taking the
 * tiles already waiting in the tray into account. A shuffle therefore never
 * makes a winnable game unwinnable. If the tray is already so full that no
 * winning deal exists, it falls back to a plain shuffle (the player is in
 * trouble either way).
 *
 * Deterministic for a given seed, so the log can be replayed.
 */
export function shuffleBoard(state: GameState, seed: number): Tile[] {
  const random = new SeededRandom(seed);
  const { board, tray } = state;

  const onBoard = countByType(board);
  const inTray = countByType(tray);
  const types = [...onBoard.keys()].sort((a, b) => a - b);

  // Tiles waiting in the tray are groups already begun; the board must finish them.
  const initialOpen: { type: number; count: number }[] = [];
  const pool: number[] = [];
  let consistent = true;
  for (const type of types) {
    const need = onBoard.get(type) as number;
    const waiting = inTray.get(type) ?? 0;
    const toFinish = waiting > 0 ? MATCH_SIZE - waiting : 0;
    const rest = need - toFinish;
    if (rest < 0 || rest % MATCH_SIZE !== 0) {
      consistent = false;
      break;
    }
    if (waiting > 0) {
      initialOpen.push({ type, count: waiting });
    }
    for (let g = 0; g < rest / MATCH_SIZE; g++) {
      pool.push(type);
    }
  }

  if (consistent) {
    try {
      const order = randomRemovalOrder(board, random);
      const dealt = dealTypes({
        order,
        pool: shuffled(random, pool),
        initialOpen,
        slack: 0,
        interleave: 0.5,
        random,
      });
      return board.map(t => ({ ...t, typeId: dealt.get(t.id) as number }));
    } catch (error) {
      if (!(error instanceof DealError)) {
        throw error;
      }
    }
  }

  // Fallback: same pictures, plain random positions.
  const pictures = shuffled(
    random,
    board.map(t => t.typeId),
  );
  return board.map((t, i) => ({ ...t, typeId: pictures[i] as number }));
}
