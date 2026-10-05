import { generateLevel, levelFingerprint } from '@engine';

/**
 * Generated levels are "fixed per id": saved games are tied to a level's
 * fingerprint, and players expect level N to be the same tomorrow. These
 * fingerprints were recorded from the generator before its type-dealing code
 * was moved into the engine core in Phase 10. Levels 11 and up were re-recorded
 * when the difficulty ramp was raised (levels 1-10 are unchanged). If this test fails, a change
 * altered generated levels: either undo it, or accept that every saved game
 * on a changed level will be discarded and record the new values here.
 */
const EXPECTED: Readonly<Record<number, string>> = {
  1: '04678309',
  2: '203418e4',
  5: '2c81a1df',
  11: 'd3d1707f',
  50: 'b53bfe19',
  100: '390de9a9',
  101: 'b5063196',
  300: 'c68f0cb5',
  500: 'ff143a1b',
  501: '24884634',
  1000: 'd6f910d5',
  2000: '0acd903a',
  2001: '26830ae0',
  2010: '22053b4d',
  5000: '50d15773',
  6813: 'effd1969',
  10000: 'a03fcbf4',
  12345: '46fbb913',
};

describe('generated levels stay exactly the same', () => {
  it.each(Object.entries(EXPECTED))('level %s', (id, fingerprint) => {
    expect(levelFingerprint(generateLevel(Number(id)))).toBe(fingerprint);
  });

  it('and so do levels made with a different base seed', () => {
    expect(levelFingerprint(generateLevel(77, { baseSeed: 5 }))).toBe(
      'fb19c8dc',
    );
  });
});
