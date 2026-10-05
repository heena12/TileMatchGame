import type { HapticKind, IHaptics } from './IHaptics';

export class NoopHaptics implements IHaptics {
  trigger(_kind: HapticKind): void {}
}
