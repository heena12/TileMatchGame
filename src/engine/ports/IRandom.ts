/**
 * Source of randomness for the engine. Injected so that games are
 * deterministic and replayable (multiplayer, leaderboard verification).
 */
export interface IRandom {
  /** Returns a float in [0, 1). */
  next(): number;
}
