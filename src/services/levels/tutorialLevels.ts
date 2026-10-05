import type { LevelData } from '@engine';
import { buildLevel, select, tap } from './levelDsl';
import type { LevelSpec } from './levelDsl';

/** Tutorial levels are verified with 3 spare tray slots (GAME_DESIGN 13.3). */
const SLACK = 3;

// Layers straddle the one below by half a cell.
const HALF = { dx: 0.5, dy: 0.5 } as const;

/**
 * The ten guided levels (GAME_DESIGN 13.5). Each drawing shows the tiles as
 * letters; the steps refer to tiles by (layer, row, column) as drawn.
 * Everything a step says is a key in ui/i18n/strings.ts.
 */
const SPECS: readonly LevelSpec[] = [
  // 1. Tap a tile; three of a kind vanish.
  {
    levelId: 1,
    slack: SLACK,
    layers: [{ rows: ['AAABBB', 'CCCAAA', 'BBBCCC'] }],
    steps: at => [
      select('tutorial.l1.tap', at(0, 0, 0)),
      select('tutorial.l1.same', at(0, 0, 1)),
      select('tutorial.l1.three', at(0, 0, 2)),
    ],
  },

  // 2. Different pictures wait in the tray; a third completes the set.
  {
    levelId: 2,
    slack: SLACK,
    layers: [{ rows: ['ABCABC', 'BCABCA', 'CABCAB'] }],
    steps: at => [
      select('tutorial.l2.first', at(0, 0, 0)),
      select('tutorial.l2.wait', at(0, 0, 1)),
      select('tutorial.l2.again', at(0, 0, 3)),
      select('tutorial.l2.match', at(0, 1, 2)),
    ],
  },

  // 3. Covered tiles cannot be tapped; clearing the top frees what is under it.
  {
    levelId: 3,
    slack: SLACK,
    layers: [
      { rows: ['BCBCB', 'CBCBC', 'AAABC'] },
      { rows: ['A.A.A'], ...HALF },
    ],
    steps: at => [
      tap('tutorial.l3.covered', at(0, 0, 0), at(0, 0, 1)),
      select('tutorial.l3.top', at(1, 0, 0)),
      select('tutorial.l3.next', at(1, 0, 2)),
      select('tutorial.l3.last', at(1, 0, 4)),
      tap('tutorial.l3.under', at(0, 0, 0)),
    ],
  },

  // 4. The tray holds 7 tiles; how to avoid filling it.
  {
    levelId: 4,
    slack: SLACK,
    layers: [{ rows: ['ABCDAB', 'CDABCD', 'BCDABC', 'ADBCDA'] }],
    steps: at => [
      tap('tutorial.l4.capacity'),
      select('tutorial.l4.pile', at(0, 0, 0)),
      select('tutorial.l4.pile', at(0, 0, 1)),
      select('tutorial.l4.pile', at(0, 0, 2)),
      select('tutorial.l4.match', at(0, 0, 4)),
      select('tutorial.l4.clear', at(0, 1, 2)),
    ],
  },

  // 5. Layers: start from the top.
  {
    levelId: 5,
    slack: SLACK,
    layers: [
      { rows: ['CDCDCD', 'DCDCDC', 'AAABBB'] },
      { rows: ['A.A.A', 'B.B.B'], ...HALF },
    ],
    steps: at => [
      tap('tutorial.l5.layers', at(1, 0, 0), at(1, 0, 2), at(1, 0, 4)),
      select('tutorial.l5.top', at(1, 0, 0)),
      select('tutorial.l5.more', at(1, 0, 2)),
      select('tutorial.l5.done', at(1, 0, 4)),
    ],
  },

  // 6. Plan ahead: pick tiles that uncover more matches.
  {
    levelId: 6,
    slack: SLACK,
    layers: [
      { rows: ['CDCDCD', 'DCDCDC', 'AABBAB'] },
      { rows: ['A.B.A', 'B.A.B'], ...HALF },
    ],
    steps: at => [
      tap('tutorial.l6.plan', at(1, 0, 0)),
      select('tutorial.l6.pick', at(1, 0, 0)),
      select('tutorial.l6.more', at(1, 1, 2)),
      select('tutorial.l6.uncover', at(1, 0, 4)),
    ],
  },

  // 7. Quick matches build a combo.
  {
    levelId: 7,
    slack: SLACK,
    layers: [{ rows: ['AAABBB', 'CCCDDD', 'AAABBB', 'CCCDDD'] }],
    steps: at => [
      tap('tutorial.l7.combo'),
      select('tutorial.l7.first', at(0, 0, 0)),
      select('tutorial.l7.first', at(0, 0, 1)),
      select('tutorial.l7.first', at(0, 0, 2)),
      select('tutorial.l7.quick', at(0, 0, 3)),
      select('tutorial.l7.quick', at(0, 0, 4)),
      select('tutorial.l7.bonus', at(0, 0, 5)),
    ],
  },

  // 8. Stars and bonus points.
  {
    levelId: 8,
    slack: SLACK,
    layers: [
      { rows: ['AABBCC', 'BBCCAA', 'CCAABB'] },
      { rows: ['A.B.C', 'B.C.A', 'C.A.B'], ...HALF },
    ],
    steps: () => [tap('tutorial.l8.stars')],
  },

  // 9. Preview of boosters (none are granted before Phase 10).
  {
    levelId: 9,
    slack: SLACK,
    layers: [
      { rows: ['ABCABC', 'CABCAB', 'BCABCA'] },
      { rows: ['A.B.C', 'C.A.B', 'B.C.A'], ...HALF },
    ],
    steps: () => [tap('tutorial.l9.boosters')],
  },

  // 10. Ready: finishing this one completes the tutorial.
  {
    levelId: 10,
    slack: SLACK,
    layers: [
      { rows: ['CDCDCD', 'DCDCDC', 'CDCDCD', 'AAABBB'] },
      { rows: ['A.B.A', 'B.A.B'], ...HALF },
    ],
    steps: () => [tap('tutorial.l10.ready')],
  },
];

export const TUTORIAL_LEVELS: Readonly<Record<number, LevelData>> =
  Object.fromEntries(SPECS.map(spec => [spec.levelId, buildLevel(spec)]));

export const TUTORIAL_LEVEL_IDS: readonly number[] = SPECS.map(s => s.levelId);
