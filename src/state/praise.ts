/** Praise shown and spoken after a match, like the banners in the reference game. */
/** Colour family of the banner text. */
export type PraiseTone = 'gold' | 'green' | 'pink';

export interface Praise {
  readonly text: string;
  /** Shown as "X3" beside the text for long chains; 0 means no multiplier. */
  readonly multiplier: number;
  /** What the voice says. */
  readonly spoken: string;
  readonly tone: PraiseTone;
}

const PHRASES: readonly { text: string; tone: PraiseTone }[] = [
  { text: 'Excellent!', tone: 'green' },
  { text: 'Superb Control', tone: 'gold' },
  { text: "That's Amazing!", tone: 'gold' },
  { text: 'Epic Moment', tone: 'gold' },
  { text: 'Awesome!', tone: 'green' },
  { text: "You're Great!", tone: 'green' },
];

/** First chained match: the combo has just started. */
const CHAIN_FROM = 2;

/**
 * Pure and deterministic: the same step always gets the same praise, so
 * tests and replays match. Long chains get "Unbelievable" with a multiplier.
 */
export function praiseFor(comboLevel: number, seq: number): Praise {
  if (comboLevel >= CHAIN_FROM) {
    return {
      text: 'Unbelievable',
      multiplier: comboLevel,
      spoken: 'Unbelievable!',
      tone: 'pink',
    };
  }
  const phrase = PHRASES[(comboLevel * 2 + seq) % PHRASES.length] ?? PHRASES[0];
  const text = phrase?.text ?? 'Excellent!';
  return {
    text,
    multiplier: 0,
    spoken: text,
    tone: phrase?.tone ?? 'gold',
  };
}
