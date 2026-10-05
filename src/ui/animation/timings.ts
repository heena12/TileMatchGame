/** Animation durations in milliseconds. One place to tune the feel. */
export const ANIMATION = {
  /** Tile flying from the board to its tray slot. */
  flightMs: 260,
  /** Matched tiles popping and fading. Starts when the flight lands. */
  burstMs: 520,
  /** Paper shards thrown out of a match. Starts when the flight lands. */
  shardsMs: 800,
  /** Star, confetti and shine around a match. Starts when the flight lands. */
  celebrateMs: 950,
  /** Red flash and shake on a covered tile. */
  flashMs: 320,
  /** Pause before the Result screen so the last match can be seen. */
  endDelayMs: 1100,
  /** Extra time before an effect is dropped from the layer. */
  cleanupSlackMs: 40,
} as const;
