import type { Command, ILevelSource, LevelData, RunClaim } from '@engine';
import {
  LEVEL_SCHEMA_VERSION,
  evaluateCommandLog,
  levelFingerprint,
} from '@engine';
import type { GameSessionStore } from '@state/gameSessionStore';
import { currentStep } from '@state/tutorialStore';
import type { TutorialStore } from '@state/tutorialStore';

/**
 * Two types, three tiles each, in a row. Tapping ids 1..6 in order wins;
 * the first three form one match and the last three a chained match.
 */
export function tinyLevel(levelId: number): LevelData {
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    levelId,
    tiles: [1, 2, 3, 4, 5, 6].map(id => ({
      id,
      typeId: id <= 3 ? 1 : 2,
      x: id - 1,
      y: 0,
      layer: 0,
    })),
    twoStarScore: 200,
    threeStarScore: 300,
    validatedSlack: 4,
  };
}

/** Eight distinct-type triples: tapping the first tile of 7 types loses. */
export function losingLevel(levelId: number): LevelData {
  const tiles = Array.from({ length: 8 }, (_, t) =>
    [0, 1, 2].map(i => ({
      id: t * 3 + i + 1,
      typeId: t + 1,
      x: i,
      y: t,
      layer: 0,
    })),
  ).flat();
  return {
    schemaVersion: LEVEL_SCHEMA_VERSION,
    levelId,
    tiles,
    twoStarScore: 1000,
    threeStarScore: 2000,
    validatedSlack: 0,
  };
}

export function fixedSource(
  build: (levelId: number) => LevelData,
): ILevelSource<LevelData> {
  return { getLevel: async id => build(id) };
}

/** Lets pending promises and effects run. */
export const flush = () => new Promise<void>(resolve => setImmediate(resolve));

/**
 * A naive but sensible player: take a tile matching the most tiles already in
 * the tray, otherwise the lowest id. Stops when the game is no longer running.
 */
export function autoplay(
  controller: { select(id: number): void },
  session: GameSessionStore,
  limit = 300,
): void {
  for (let i = 0; i < limit; i++) {
    const s = session.getState();
    if (s.status !== 'playing' || !s.game) {
      return;
    }
    const inTray = new Map<number, number>();
    s.game.tray.forEach(t =>
      inTray.set(t.typeId, (inTray.get(t.typeId) ?? 0) + 1),
    );
    const free = s.game.board.filter(t => s.freeTileIds.includes(t.id));
    const pick = [...free].sort(
      (a, b) =>
        (inTray.get(b.typeId) ?? 0) - (inTray.get(a.typeId) ?? 0) ||
        a.id - b.id,
    )[0];
    if (!pick) {
      return;
    }
    controller.select(pick.id);
  }
}

/** Follows every tutorial step as the game asks: tap the highlighted tile, or press "Got it". */
export function finishGuidance(
  controller: { select(id: number): void; tutorialContinue(): void },
  tutorial: TutorialStore,
): void {
  for (let i = 0; i < 50; i++) {
    const step = currentStep(tutorial.getState());
    if (!step) {
      return;
    }
    if (step.waitFor === 'tap') {
      controller.tutorialContinue();
    } else {
      controller.select(step.highlightTileIds[0] as number);
    }
  }
}

/** An honest claim for a finished run of `commands` on `level`, as a real client would send it. */
export function honestClaim(level: LevelData, commands: Command[]): RunClaim {
  const { score, stars } = evaluateCommandLog(level, commands, {
    twoStarScore: level.twoStarScore,
    threeStarScore: level.threeStarScore,
    ...(level.noBoosters !== undefined ? { noBoosters: level.noBoosters } : {}),
  });
  return {
    levelId: level.levelId,
    levelContentVersion: levelFingerprint(level),
    commands,
    score: score.score,
    stars,
  };
}

/** Tapping tiles 1..6 in order wins `tinyLevel`. */
export const tinyWin: Command[] = [1, 2, 3, 4, 5, 6].map(tileId => ({
  type: 'SELECT_TILE' as const,
  tileId,
}));

/** A slower but equally valid win: alternates the two pictures, so it scores differently. */
export const tinyWinSlow: Command[] = [1, 4, 2, 5, 3, 6].map(tileId => ({
  type: 'SELECT_TILE' as const,
  tileId,
}));
