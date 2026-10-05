import { Vibration } from 'react-native';
import type { HapticKind, IHaptics } from './IHaptics';

/** Vibration patterns in milliseconds: [wait, buzz, wait, buzz, ...]. */
export const HAPTIC_PATTERNS: Readonly<Record<HapticKind, number | number[]>> =
  {
    light: 10,
    medium: 22,
    success: [0, 18, 60, 18, 60, 30],
    error: [0, 45, 60, 45],
  };

/**
 * Uses React Native's built-in Vibration, which also maps to
 * navigator.vibrate in the web build. No extra native dependency.
 */
export class VibrationHaptics implements IHaptics {
  trigger(kind: HapticKind): void {
    try {
      Vibration.vibrate(HAPTIC_PATTERNS[kind]);
    } catch {
      // Haptics are decoration; never let them break play.
    }
  }
}
