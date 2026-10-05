import {
  GameEngine,
  MAX_RUN_COMMANDS,
  evaluateCommandLog,
  generateLevel,
  levelFingerprint,
  solve,
  verifyRun,
} from '@engine';
import type { Command, LevelData, RunClaim } from '@engine';
import { tinyLevel } from '../testUtils';

const select = (tileId: number): Command => ({ type: 'SELECT_TILE', tileId });
const level = tinyLevel(4);

/** An honest claim for a list of commands on `lvl`. */
function honest(lvl: LevelData, commands: Command[]): RunClaim {
  const { score, stars } = evaluateCommandLog(lvl, commands, {
    twoStarScore: lvl.twoStarScore,
    threeStarScore: lvl.threeStarScore,
    ...(lvl.noBoosters !== undefined ? { noBoosters: lvl.noBoosters } : {}),
  });
  return {
    levelId: lvl.levelId,
    levelContentVersion: levelFingerprint(lvl),
    commands,
    score: score.score,
    stars,
  };
}

const win = [1, 2, 3, 4, 5, 6].map(select);

describe('verifyRun accepts an honest run', () => {
  it('and returns the trusted numbers', () => {
    const result = verifyRun(level, honest(level, win));
    expect(result).toEqual({
      valid: true,
      score: 510,
      stars: 3,
      moves: 6,
      boostersUsed: 0,
    });
  });

  it('with boosters in the log, counting them', () => {
    const log: Command[] = [
      select(1),
      select(2),
      { type: 'UNDO' },
      { type: 'HINT' },
      select(2),
      ...[3, 4, 5, 6].map(select),
    ];
    const result = verifyRun(level, honest(level, log));
    expect(result).toMatchObject({ valid: true, boostersUsed: 2, moves: 6 });
  });

  it('with a shuffle in the log', () => {
    const lvl = generateLevel(120);
    const engine = new GameEngine(lvl);
    const commands: Command[] = [{ type: 'SHUFFLE', seed: 4242 }];
    engine.dispatch(commands[0] as Command);
    // Then play it out with hints.
    for (let i = 0; i < 300 && engine.getState().status === 'playing'; i++) {
      const c = select(engine.getHint() as number);
      engine.dispatch(c);
      commands.push(c);
    }
    expect(engine.getState().status).toBe('won');
    expect(verifyRun(lvl, honest(lvl, commands))).toMatchObject({
      valid: true,
      boostersUsed: 1,
    });
  });

  it('on a generated level, played by the solver', () => {
    const lvl = generateLevel(300);
    const path = solve(lvl.tiles, 7, 200000).solution as number[];
    const result = verifyRun(lvl, honest(lvl, path.map(select)));
    expect(result.valid).toBe(true);
  });

  it('every time (it is deterministic)', () => {
    const claim = honest(level, win);
    expect(verifyRun(level, claim)).toEqual(verifyRun(level, claim));
  });

  it('does not change the claim it was given', () => {
    const claim = honest(level, win);
    const before = JSON.stringify(claim);
    verifyRun(level, claim);
    expect(JSON.stringify(claim)).toBe(before);
  });
});

describe('verifyRun rejects every kind of tampering', () => {
  const claim = honest(level, win);

  it('a higher score', () => {
    expect(verifyRun(level, { ...claim, score: claim.score + 1 })).toEqual({
      valid: false,
      reason: 'SCORE_MISMATCH',
    });
  });

  it('a lower score too (the claim must be exact)', () => {
    expect(verifyRun(level, { ...claim, score: claim.score - 10 })).toEqual({
      valid: false,
      reason: 'SCORE_MISMATCH',
    });
  });

  it('more stars than earned', () => {
    const hard: LevelData = {
      ...level,
      twoStarScore: 5000,
      threeStarScore: 6000,
    };
    const oneStar = honest(hard, win);
    expect(oneStar.stars).toBe(1);
    expect(verifyRun(hard, { ...oneStar, stars: 3 })).toEqual({
      valid: false,
      reason: 'STARS_MISMATCH',
    });
    expect(verifyRun(hard, { ...oneStar, stars: 0 })).toEqual({
      valid: false,
      reason: 'STARS_MISMATCH',
    });
  });

  it('a different level id', () => {
    expect(verifyRun(level, { ...claim, levelId: 5 })).toEqual({
      valid: false,
      reason: 'LEVEL_MISMATCH',
    });
  });

  it('a fingerprint from another board', () => {
    expect(
      verifyRun(level, { ...claim, levelContentVersion: 'deadbeef' }),
    ).toEqual({ valid: false, reason: 'LEVEL_MISMATCH' });
  });

  it('a level whose content changed since the run', () => {
    const changed: LevelData = {
      ...level,
      tiles: level.tiles.map((t, i) => (i === 0 ? { ...t, y: 3 } : t)),
    };
    expect(verifyRun(changed, claim)).toEqual({
      valid: false,
      reason: 'LEVEL_MISMATCH',
    });
  });

  it('a log that does not finish the level', () => {
    const partial = honest(level, [1, 2, 3, 4].map(select));
    expect(verifyRun(level, partial)).toEqual({
      valid: false,
      reason: 'NOT_WON',
    });
  });

  it('an empty log', () => {
    expect(
      verifyRun(level, { ...claim, commands: [], score: 0, stars: 0 }),
    ).toEqual({
      valid: false,
      reason: 'NOT_WON',
    });
  });

  it('a log that lost', () => {
    const many = Array.from({ length: 7 }, (_, t) =>
      [0, 1, 2].map(i => ({
        id: t * 3 + i + 1,
        typeId: t + 1,
        x: i,
        y: t,
        layer: 0,
      })),
    ).flat();
    const lossy: LevelData = { ...level, tiles: many };
    const lostLog = [1, 4, 7, 10, 13, 16, 19].map(select);
    expect(verifyRun(lossy, honest(lossy, lostLog))).toEqual({
      valid: false,
      reason: 'NOT_WON',
    });
  });

  it('a tile that is not there', () => {
    const forged = [...win.slice(0, 5), select(999), win[5] as Command];
    expect(verifyRun(level, { ...claim, commands: forged })).toEqual({
      valid: false,
      reason: 'REJECTED_COMMAND',
    });
  });

  it('a tile taken twice', () => {
    const forged = [select(1), select(1), ...win.slice(1)];
    expect(verifyRun(level, { ...claim, commands: forged })).toEqual({
      valid: false,
      reason: 'REJECTED_COMMAND',
    });
  });

  it('a covered tile taken early', () => {
    const layered: LevelData = {
      ...level,
      tiles: [
        { id: 1, typeId: 1, x: 0, y: 0, layer: 0 },
        { id: 2, typeId: 1, x: 0.5, y: 0, layer: 1 },
        { id: 3, typeId: 1, x: 5, y: 0, layer: 0 },
      ],
    };
    const cheat = honest(layered, [2, 1, 3].map(select));
    expect(verifyRun(layered, cheat).valid).toBe(true);
    expect(
      verifyRun(layered, { ...cheat, commands: [1, 2, 3].map(select) }),
    ).toEqual({ valid: false, reason: 'REJECTED_COMMAND' });
  });

  it('an undo with nothing to undo', () => {
    const forged: Command[] = [{ type: 'UNDO' }, ...win];
    expect(verifyRun(level, { ...claim, commands: forged })).toEqual({
      valid: false,
      reason: 'REJECTED_COMMAND',
    });
  });

  it('a shuffle where only one picture remains', () => {
    const forged: Command[] = [
      ...win.slice(0, 3),
      { type: 'SHUFFLE', seed: 1 },
      ...win.slice(3),
    ];
    expect(verifyRun(level, { ...claim, commands: forged })).toEqual({
      valid: false,
      reason: 'REJECTED_COMMAND',
    });
  });

  it('moves after the game was already won', () => {
    expect(
      verifyRun(level, { ...claim, commands: [...win, select(1)] }),
    ).toEqual({ valid: false, reason: 'REJECTED_COMMAND' });
  });

  it('a log longer than any real game', () => {
    const huge = Array.from({ length: MAX_RUN_COMMANDS + 1 }, () => select(1));
    expect(verifyRun(level, { ...claim, commands: huge })).toEqual({
      valid: false,
      reason: 'TOO_MANY_COMMANDS',
    });
  });

  it('a hidden booster: stars claimed as if none were used on a no-boosters level', () => {
    const strict: LevelData = { ...level, noBoosters: true };
    const withHint: Command[] = [{ type: 'HINT' }, ...win];
    const real = honest(strict, withHint);
    expect(real.stars).toBe(2);
    expect(verifyRun(strict, real).valid).toBe(true);
    expect(verifyRun(strict, { ...real, stars: 3 })).toEqual({
      valid: false,
      reason: 'STARS_MISMATCH',
    });
  });

  it('a log with the hint removed to earn the third star', () => {
    const strict: LevelData = { ...level, noBoosters: true };
    const real = honest(strict, [{ type: 'HINT' }, ...win]);
    // Dropping the HINT from the log gives a different (3-star) result than claimed.
    expect(verifyRun(strict, { ...real, commands: win })).toEqual({
      valid: false,
      reason: 'STARS_MISMATCH',
    });
  });
});
