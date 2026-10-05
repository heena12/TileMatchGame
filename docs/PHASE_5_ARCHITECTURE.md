# Phase 5 Architecture - Engine Test Suite

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md) and [GAME_DESIGN.md](GAME_DESIGN.md) section 13.7. No engine behaviour was added; this phase proves the engine and adds the CI gate.

## Layers of tests (all under `__tests__/engine/`)

| Suite | Proves |
|---|---|
| `rules/designRules.test.ts` | One `describe` per design rule (sections 3 to 5), named after the rule, so a failure points at the design |
| `property/randomPlay.test.ts` | About 160 seeded random games, including illegal commands: tile conservation, tray never over 7 (6 while playing), no 3-of-a-kind left waiting, groups stay together, status matches board/tray, rejected commands leave state identical, score never decreases, every game ends, the command log replays to the same state and the same score. States are deep-frozen so any mutation throws |
| `levels/shippedLevels.test.ts` | Every `content/levels/*.json` parses and is solvable at its claimed slack; levels 1 to 150, all tier boundaries and a seeded spread across 10000 levels validate |
| Existing suites | Board, tray, scoring, level format, generator, solver, sources, purity |

## CI gate
`npm run ci` = `tsc` (app and engine configs) + ESLint + Jest with coverage. Jest fails if `src/engine` drops below 90% statements, branches, functions or lines. `.github/workflows/ci.yml` runs it on every pull request and on `main`.

## Finding made by this phase
The level-validation gate found generated level 6813 unverifiable within the 200,000-node budget (it needed about 283,000). The level was solvable; the solver's search order was weak. The solver now also prefers tiles whose type has enough free copies to finish a group. On 800 sampled levels the worst case is about 45,000 nodes, and none fail at the default budget.

## Not covered here
Difficulty as felt by players (needs playtesting or analytics), UI tests (Phase 6), device smoke tests (Maestro, before release).
