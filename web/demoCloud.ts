import {
  GameEngine,
  SeededRandom,
  evaluateCommandLog,
  levelFingerprint,
} from '@engine';
import type { Command, RunClaim } from '@engine';
import { createContainer } from '../src/app/di/container';
import type { Container } from '../src/app/di/container';
import { InMemoryBackend } from '../src/services/cloud/InMemoryBackend';
import { createLevelSource } from '../src/services/levels/createLevelSource';

const RIVALS = ['Maya', 'Leo', 'Zoe', 'Kai'];

/** Plays level 1 with a seeded random player until it wins, and returns that run as a claim. */
async function winningRun(seed: number): Promise<RunClaim | null> {
  const level = await createLevelSource().getLevel(1);
  const rng = new SeededRandom(seed);
  const engine = new GameEngine(level);
  const commands: Command[] = [];
  while (engine.getState().status === 'playing') {
    const free = engine.getFreeTileIds();
    const command: Command = {
      type: 'SELECT_TILE',
      tileId: free[Math.floor(rng.next() * free.length)] as number,
    };
    engine.dispatch(command);
    commands.push(command);
  }
  if (engine.getState().status !== 'won') {
    return null;
  }
  const { score, stars } = evaluateCommandLog(level, commands, {
    twoStarScore: level.twoStarScore,
    threeStarScore: level.threeStarScore,
  });
  return {
    levelId: level.levelId,
    levelContentVersion: levelFingerprint(level),
    commands,
    score: score.score,
    stars,
  };
}

/**
 * Development only: the app wired to the in-memory reference backend, with a few
 * rivals already on the level 1 leaderboard. Lets the cloud and leaderboard
 * screens be tried in a browser before any real provider exists. Every rival
 * run is a genuine game and goes through the same server-side check as yours.
 */
export async function createDemoContainer(): Promise<Container> {
  const levels = createLevelSource();
  const backend = new InMemoryBackend(levels);

  const seenScores = new Set<number>();
  let rival = 0;
  for (let seed = 1; seed < 400 && rival < RIVALS.length; seed++) {
    const run = await winningRun(seed);
    if (run && !seenScores.has(run.score)) {
      seenScores.add(run.score);
      await backend
        .client(`rival-${rival}`, RIVALS[rival] as string)
        .leaderboard.submit(run);
      rival++;
    }
  }

  const me = backend.client('you', 'You');
  return createContainer({
    levelSource: levels,
    cloud: me.cloud,
    leaderboard: me.leaderboard,
  });
}
