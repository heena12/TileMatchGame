import type { IClock } from '@engine';

export class SystemClock implements IClock {
  now(): number {
    return Date.now();
  }
}
