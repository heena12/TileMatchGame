import type { IRandom } from '@engine';

/** The one place the app draws real randomness (shuffle seeds). Tests inject a fixed one. */
export class MathRandom implements IRandom {
  next(): number {
    return Math.random();
  }
}
