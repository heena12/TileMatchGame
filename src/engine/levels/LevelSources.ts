import type { ILevelSource } from '../ports/ILevelSource';
import { generateLevel } from './LevelGenerator';
import type { GenerateOptions } from './LevelGenerator';
import { LevelDataError, LevelNotFoundError } from './LevelData';
import type { LevelData } from './LevelData';
import { parseLevelData } from './parseLevelData';

/** Supplies raw JSON for one level, or undefined when there is none. Provided by the app layer. */
export type LevelLoader = (levelId: number) => Promise<unknown>;

/** Hand-made levels loaded lazily by id. */
export class AuthoredLevelSource implements ILevelSource<LevelData> {
  constructor(private readonly load: LevelLoader) {}

  async getLevel(levelId: number): Promise<LevelData> {
    const raw = await this.load(levelId);
    if (raw === undefined || raw === null) {
      throw new LevelNotFoundError(levelId);
    }
    const level = parseLevelData(raw);
    if (level.levelId !== levelId) {
      throw new LevelDataError(
        `Requested level ${levelId} but data says ${level.levelId}`,
      );
    }
    return level;
  }
}

/** Levels generated from (levelId, seed), with a small LRU cache. */
export class GeneratedLevelSource implements ILevelSource<LevelData> {
  private readonly cache = new Map<number, LevelData>();

  constructor(
    private readonly options: GenerateOptions = {},
    private readonly cacheSize = 16,
  ) {}

  async getLevel(levelId: number): Promise<LevelData> {
    const cached = this.cache.get(levelId);
    if (cached) {
      this.cache.delete(levelId);
      this.cache.set(levelId, cached);
      return cached;
    }
    const level = generateLevel(levelId, this.options);
    this.cache.set(levelId, level);
    if (this.cache.size > this.cacheSize) {
      const oldest = this.cache.keys().next().value as number;
      this.cache.delete(oldest);
    }
    return level;
  }
}

/** Tries each source in order; a source that does not have the level passes it on. */
export class CompositeLevelSource implements ILevelSource<LevelData> {
  constructor(private readonly sources: readonly ILevelSource<LevelData>[]) {}

  async getLevel(levelId: number): Promise<LevelData> {
    for (const source of this.sources) {
      try {
        return await source.getLevel(levelId);
      } catch (error) {
        if (!(error instanceof LevelNotFoundError)) {
          throw error;
        }
      }
    }
    throw new LevelNotFoundError(levelId);
  }
}
