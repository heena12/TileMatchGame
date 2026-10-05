/* eslint-disable no-bitwise -- hash/PRNG arithmetic needs 32-bit integer ops */
import type { IRandom } from '../ports/IRandom';

/** Deterministic PRNG (Mulberry32). Same seed gives the same sequence everywhere. */
export class SeededRandom implements IRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

/** Mixes integers into one 32-bit seed. */
export function hashSeed(...parts: number[]): number {
  let h = 2166136261;
  for (const part of parts) {
    h = Math.imul(h ^ (part >>> 0), 16777619);
    h ^= h >>> 13;
    h = Math.imul(h, 0x5bd1e995);
    h ^= h >>> 15;
  }
  return h >>> 0;
}

/** Integer in [0, bound). */
export function randomInt(random: IRandom, bound: number): number {
  return Math.floor(random.next() * bound);
}

/** Returns a shuffled copy (Fisher-Yates). */
export function shuffled<T>(random: IRandom, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(random, i + 1);
    const a = result[i] as T;
    result[i] = result[j] as T;
    result[j] = a;
  }
  return result;
}
