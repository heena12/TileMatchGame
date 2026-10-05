/** Fixed tray geometry, shared by the Tray view and the animation planner. */
export const TRAY_PADDING = 8;
export const TRAY_SLOT_WIDTH = 40;
/** Square, so a flying tile lands at exactly the size of the tile it becomes. */
export const TRAY_SLOT_HEIGHT = 40;
export const TRAY_SLOT_GAP = 4;

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Slot `index` of a tray whose top-left corner is at `origin`. */
export function traySlotRect(
  origin: { readonly left: number; readonly top: number },
  index: number,
): Rect {
  return {
    left:
      origin.left + TRAY_PADDING + index * (TRAY_SLOT_WIDTH + TRAY_SLOT_GAP),
    top: origin.top + TRAY_PADDING,
    width: TRAY_SLOT_WIDTH,
    height: TRAY_SLOT_HEIGHT,
  };
}
