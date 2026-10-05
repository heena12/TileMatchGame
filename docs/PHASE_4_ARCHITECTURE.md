# Phase 4 Architecture - Levels

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Decisions: [GAME_DESIGN.md](GAME_DESIGN.md) sections 4, 6, 13.3, 13.4.

Everything is pure TypeScript under `src/engine/levels/`. No engine core file is modified.

```
levelId --> getDifficultyConfig --> LevelGenerator --> LevelData --+
                                        |  (seeded, deterministic)  |
authored JSON --> parseLevelData -------+--------------------------+--> ILevelSource<LevelData> --> GameEngine
                                                                          (Composite: authored first, generated fallback)
offline / CI:  LevelData --> validateLevelData --> SolvabilityChecker (DFS + memo + node budget)
```

| File | Responsibility |
|---|---|
| `LevelData.ts` | `LevelData` (schema v1), `LevelDataError`, `LevelNotFoundError` |
| `parseLevelData.ts` | Validates untrusted JSON into `LevelData` (schema + game rules) |
| `SeededRandom.ts` | Deterministic `IRandom` (Mulberry32) and `hashSeed` |
| `DifficultyConfig.ts` | `getDifficultyConfig(levelId)`: tier table from design section 6, interpolated by position in the tier |
| `SolvabilityChecker.ts` | `solve(tiles, maxTray, nodeBudget)` |
| `LevelValidator.ts` | `validateLevelData`: rules + solvability at the level's claimed slack |
| `LevelGenerator.ts` | `generateLevel(levelId, options)` by reverse play |
| `LevelSources.ts` | `AuthoredLevelSource`, `GeneratedLevelSource`, `CompositeLevelSource` |

## Level data (schema v1)
`levelId, schemaVersion, themeId, tiles[], twoStarScore, threeStarScore, noBoosters?, validatedSlack`. The tutorial field arrives in Phase 8 and will be an additive optional field.

## Generation: solvable by construction
1. Difficulty config gives type count, tile count, layers, overlap density, required slack and interleave.
2. Positions are chosen on a 8 x 10 grid. Odd layers are shifted by half cells so tiles overlap. Same-layer tiles never overlap.
3. A random valid removal order is built (a tile is only picked when free).
4. Tile types are assigned along that order using "open groups": a type group is started or joined only while the tray stays within `7 - slack` (and never reaches 7 without a match). The order is therefore a winning play with the required slack.
5. Everything derives from `hashSeed(baseSeed, levelId, attempt)`, so the same id always yields the same level (Rule 9: multiplayer, leaderboard).

## Validation (design 13.3)
DFS over free tiles, memoized on the set of remaining tiles (the tray contents follow from it). Tiles that complete a match are tried first, then tiles that join a waiting type. A node budget bounds the work and **exhausting it counts as a failure**, never as solvable. Validation is for tooling and CI; the app does not run it.

## Level sources and 10000 levels
No level list exists in memory. `getLevel(id)` loads or generates one level; `GeneratedLevelSource` keeps a small LRU. Bundled authored levels are provided through a loader function by the app layer, so the engine never touches files or Metro.

## Tests
Seeded RNG, difficulty table and boundaries, parser errors, generator invariants across all tiers (tile count multiple of 3, every type a multiple of 3, no same-layer overlap, determinism), solver on hand-made solvable and unsolvable levels, budget exhaustion, sources, and a sample of generated levels from every tier validated by the solver at their claimed slack.
