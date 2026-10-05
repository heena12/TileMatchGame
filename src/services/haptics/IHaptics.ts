export type HapticKind = 'light' | 'medium' | 'success' | 'error';

export interface IHaptics {
  /** Fire and forget. Must never throw. */
  trigger(kind: HapticKind): void;
}
