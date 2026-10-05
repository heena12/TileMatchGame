# Phase 3 Architecture - Scoring, Combo and Stars

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Decisions: [GAME_DESIGN.md](GAME_DESIGN.md) sections 5, 13.1, 13.2, 13.9.

The Phase 2 core is unchanged. Scoring lives in `src/engine/scoring/` and only reads engine events.

```
GameEngine.dispatch --> GameEvent[] --> applyEvents(ScoreState, events) --> ScoreState'
                                              |-- ComboSystem (window, level, bonus)
                                              +-- clear bonus on LEVEL_COMPLETED
ScoreState.score + thresholds --> calculateStars --> calculateReward(stars, previousBest)
```

| File | Responsibility |
|---|---|
| `scoring/constants.ts` | All tuning numbers in one place |
| `scoring/ComboSystem.ts` | `registerMatch`, `registerMissedSelection`, `ComboState` |
| `scoring/ScoreSystem.ts` | `applyEvents`, `ScoreState`, `calculateClearBonus` |
| `scoring/StarSystem.ts` | `calculateStars`, `referenceScore`, `defaultThresholds` |
| `scoring/RewardSystem.ts` | `calculateReward` (coins) |
| `scoring/evaluate.ts` | `evaluateCommandLog`: replay a log and return score, win, stars (server-side verification) |

## Rules
- Selection: 10. Match: 100. Combo bonus: 50 x level (first match level 0, chained +1, cap 5).
- A match chains if it is within 3 accepted selections of the previous match. After 3 selections without a match the combo resets.
- Clear bonus: 50 x (7 - peak tray occupancy). See design 13.9.
- Stars: 0 on loss, 1 on clear, 2 at `twoStarScore`, 3 at `threeStarScore` (and no booster if `noBoosters`).
- Coins: first clear 10 + 5 x stars, improvement 5 per extra star, otherwise 0.

## Properties
- Pure functions, no I/O, randomness or clock. Same events in, same score out.
- Score is derived from events, never stored in the engine, so it is verifiable from the command log.
- Scoring can change independently of the rules engine.

## Tests
`__tests__/engine/scoring/`: combo chaining, cap, reset; base points; clear bonus; stars including `noBoosters`; rewards; replay evaluation. Coverage of `src/engine` is 100% of statements, branches, functions and lines.
