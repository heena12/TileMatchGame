import { hashSeed } from './SeededRandom';
import type { LevelData } from './LevelData';

/**
 * A short identity for a level's playable content: its id and every tile's
 * id, type, position and layer. Two levels with the same fingerprint play the
 * same, so a saved game can only be replayed onto the board it came from.
 * Star thresholds and tutorial text are not part of it: they do not change how
 * the board plays.
 */
export function levelFingerprint(level: LevelData): string {
  const parts: number[] = [level.levelId, level.tiles.length];
  for (const tile of level.tiles) {
    // Positions use half cells, so doubling keeps them integers.
    parts.push(
      tile.id,
      tile.typeId,
      Math.round(tile.x * 2),
      Math.round(tile.y * 2),
      tile.layer,
    );
  }
  return hashSeed(...parts)
    .toString(16)
    .padStart(8, '0');
}
