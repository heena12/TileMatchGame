/**
 * Loads levels by id. Levels are never held as a full list, which keeps
 * 10000+ levels cheap. The level type is defined in Phase 4.
 */
export interface ILevelSource<TLevel> {
  getLevel(levelId: number): Promise<TLevel>;
}
