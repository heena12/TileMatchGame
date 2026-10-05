import type { HapticKind, IHaptics } from './IHaptics';

/** Keeps triggered haptics in memory. Used by tests. */
export class RecordingHaptics implements IHaptics {
  readonly triggered: HapticKind[] = [];

  trigger(kind: HapticKind): void {
    this.triggered.push(kind);
  }
}
