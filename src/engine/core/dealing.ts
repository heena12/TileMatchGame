import type { IRandom } from '../ports/IRandom';
import { isFree } from './board';
import { randomInt } from './random';
import { MATCH_SIZE, TRAY_SIZE } from './rules';
import type { Tile } from './types';

export class DealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DealError';
  }
}

/** A random order in which every tile is free at the moment it is removed. */
export function randomRemovalOrder(
  tiles: readonly Tile[],
  random: IRandom,
): Tile[] {
  let board = [...tiles];
  const order: Tile[] = [];
  while (board.length > 0) {
    const free = board.filter(t => isFree(t, board));
    const pick = free[randomInt(random, free.length)] as Tile;
    order.push(pick);
    board = board.filter(t => t.id !== pick.id);
  }
  return order;
}

/** A set of tiles of one type that is partly collected (tiles already in the tray). */
export interface OpenGroup {
  readonly type: number;
  readonly count: number;
}

export interface DealInput {
  /** The order the tiles will be taken in; every tile is free when its turn comes. */
  readonly order: readonly Tile[];
  /**
   * One entry per complete group of three still to be formed, naming its type.
   * Groups are started from the end of this list.
   */
  readonly pool: readonly number[];
  /** Groups already begun (tiles waiting in the tray) that the order must finish. */
  readonly initialOpen: readonly OpenGroup[];
  /** Spare tray slots to keep: the tray never holds more than `7 - slack`. */
  readonly slack: number;
  /** 0..1: how often a new group is started rather than finishing an open one. */
  readonly interleave: number;
  readonly random: IRandom;
}

/**
 * Walks the removal order and gives each tile a type so that the tray stays
 * within `7 - slack`. Groups of three are started and joined while keeping
 * one group always finishable ("safe" state), so the order is a winning play.
 * Returns tile id -> type. Throws DealError if the start is already unsafe or
 * the deal reaches a dead end.
 *
 * Used both to generate levels (nothing in the tray yet) and to shuffle a game
 * in progress (tiles already in the tray), so a shuffle can never strand the
 * player with an unwinnable board.
 */
export function dealTypes(input: DealInput): Map<number, number> {
  const { order, initialOpen, slack, interleave, random } = input;
  const pool = [...input.pool];

  const limit = TRAY_SIZE - slack;
  const nonMatchLimit = Math.min(limit, TRAY_SIZE - 1);
  const sum = (counts: readonly number[]) => counts.reduce((a, b) => a + b, 0);
  const safe = (counts: readonly number[]) => {
    const occ = sum(counts);
    return (
      counts.length === 0 ||
      counts.some(
        c =>
          occ + (MATCH_SIZE - c - 1) <= nonMatchLimit &&
          occ + (MATCH_SIZE - c) <= limit,
      )
    );
  };

  const open: { type: number; count: number }[] = initialOpen.map(g => ({
    type: g.type,
    count: g.count,
  }));
  if (!safe(open.map(o => o.count))) {
    throw new DealError('The tray is too full to deal a winnable board');
  }
  const result = new Map<number, number>();

  for (const tile of order) {
    const occ = sum(open.map(o => o.count));
    const joins: number[] = [];
    open.forEach((o, i) => {
      const completes = o.count === MATCH_SIZE - 1;
      if (occ + 1 > (completes ? limit : nonMatchLimit)) {
        return;
      }
      const after = open
        .map((g, j) => (j === i ? g.count + 1 : g.count))
        .filter(c => c < MATCH_SIZE);
      if (safe(after)) {
        joins.push(i);
      }
    });
    const canStart =
      pool.length > 0 &&
      occ + 1 <= nonMatchLimit &&
      safe([...open.map(o => o.count), 1]);

    if (canStart && (joins.length === 0 || random.next() < interleave)) {
      const type = pool.pop() as number;
      open.push({ type, count: 1 });
      result.set(tile.id, type);
    } else if (joins.length > 0) {
      const index = joins[randomInt(random, joins.length)] as number;
      const group = open[index] as { type: number; count: number };
      group.count++;
      result.set(tile.id, group.type);
      if (group.count === MATCH_SIZE) {
        open.splice(index, 1);
      }
    } else {
      throw new DealError('Type assignment reached a dead end');
    }
  }
  return result;
}
