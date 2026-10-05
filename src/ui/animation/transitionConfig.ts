/**
 * Screen transition timing. A plain object so tests can switch the exit fade
 * off (navigation then happens at once) without waiting on timers.
 */
export const transitionConfig = {
  /** The screen being left fades out for this long before the next opens (ms). */
  exitMs: 140,
  /** How long a popup card (Settings) takes to fade out when closed (ms). */
  modalMs: 200,
};
