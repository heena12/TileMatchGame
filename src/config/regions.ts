import { APP_CONFIG } from './constants';

/**
 * The level map groups levels into "countries": France first (3 pictures over
 * levels 1-12), Argentina next (13-80), then 80 levels each, five pictures per
 * country. A picture is revealed once every level it covers is cleared.
 */
const NAMES = [
  'France',
  'Argentina',
  'Sweden',
  'United States',
  'Italy',
  'Portugal',
  'Spain',
  'Austria',
  'Poland',
  'Germany',
  'Switzerland',
  'Norway',
  'Ireland',
  'Russia',
  'Turkey',
  'Egypt',
  'India',
  'Australia',
  'China',
  'Japan',
  'United Kingdom',
  'Netherlands',
  'Brazil',
  'Mexico',
  'Canada',
  'Greece',
  'New Zealand',
  'Peru',
] as const;

export interface MapSlot {
  readonly first: number;
  readonly last: number;
}

export interface MapRegion {
  readonly index: number;
  readonly name: string;
  readonly first: number;
  readonly last: number;
  readonly slots: readonly MapSlot[];
}

export const REGION_COUNT = regionIndexOf(APP_CONFIG.maxLevels) + 1;

/** First and last level of region `index`, before clamping to the last level. */
function regionBounds(index: number): { first: number; last: number } {
  if (index === 0) {
    return { first: 1, last: 12 };
  }
  if (index === 1) {
    return { first: 13, last: 80 };
  }
  const first = 81 + (index - 2) * 80;
  return { first, last: first + 79 };
}

export function regionIndexOf(levelId: number): number {
  if (levelId <= 12) {
    return 0;
  }
  if (levelId <= 80) {
    return 1;
  }
  return 2 + Math.floor((levelId - 81) / 80);
}

export function regionAt(index: number): MapRegion {
  const { first, last: rawLast } = regionBounds(index);
  const last = Math.min(rawLast, APP_CONFIG.maxLevels);
  const slotCount = index === 0 ? 3 : 5;
  const span = Math.ceil((last - first + 1) / slotCount);
  const slots = Array.from({ length: slotCount }, (_, i) => ({
    first: first + i * span,
    last: Math.min(last, first + (i + 1) * span - 1),
  })).filter(slot => slot.first <= last);
  return {
    index,
    name: NAMES[index % NAMES.length] as string,
    first,
    last,
    slots,
  };
}

export type SlotState = 'done' | 'current' | 'locked';

/** Done once every level of the slot is cleared; current while it holds the next level. */
export function slotState(slot: MapSlot, highestUnlocked: number): SlotState {
  if (highestUnlocked > slot.last) {
    return 'done';
  }
  return highestUnlocked >= slot.first ? 'current' : 'locked';
}

/** The level to open when a slot is tapped: the next level, or the slot's first to replay. */
export function levelForSlot(slot: MapSlot, highestUnlocked: number): number {
  return slotState(slot, highestUnlocked) === 'current'
    ? highestUnlocked
    : slot.first;
}
