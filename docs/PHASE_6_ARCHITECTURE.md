# Phase 6 Architecture - Screens

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Decisions: [GAME_DESIGN.md](GAME_DESIGN.md) sections 9, 13.6, 13.8.

Scope: the six real screens wired to the engine, theme tokens, string table, analytics interface and events, minimal player progress. Not in scope: animation and audio (Phase 7), tutorial (Phase 8), progress migrations, resume and cloud merge (Phase 9), boosters (Phase 10).

```
ui screens/components --hooks--> state (Zustand stores + GameController) --> engine (GameEngine, scoring, levels)
                                        |--> services: IAnalytics, IStorage
app/di/container.ts builds everything and hands it to the UI through one context.
```

The engine stays untouched. `ui -> state -> engine`, `ui -> services` for types only, as in the Phase 1 dependency rule.

## Pieces

| Area | Files | Role |
|---|---|---|
| Controller | `state/gameController.ts` | Orchestrates one play session: loads a level through `ILevelSource`, owns the `GameEngine`, folds events into the score, computes stars and coins on a win, records progress, emits analytics. Ignores stale async loads. UI never touches the engine. |
| Session store | `state/gameSessionStore.ts` | Thin cache for rendering: status, board/tray snapshot, free tile ids, score, result. No rules. |
| Progress store | `state/progressStore.ts` | `highestUnlockedLevel`, sparse `levels` map (`stars`, `bestScore`), `coins`, `updatedAt`, versioned and saved through `IStorage`. Sparse, so 10000 levels cost nothing. |
| Analytics | `services/analytics/*` | `IAnalytics` with a typed event union, `NoopAnalytics`, `RecordingAnalytics` for tests. Events: `app_open`, `level_start`, `level_complete`, `level_fail`. Derived from engine events in the controller, never in the engine. |
| Theme | `ui/theme/tokens.ts`, `tileArt.ts` | Colours, spacing, type scale; tile art resolved from `typeId` (30 glyphs), as the design says. |
| i18n | `ui/i18n/strings.ts` | Every user-visible string is a key; `t(key, vars)`. |
| Board | `ui/game/boardLayout.ts`, `TileView`, `Tray`, `GameBoard` | Pure geometry (8 x 10 logical grid to pixels), memoized tile views so a 150-tile board re-renders only tiles whose state changed. |
| Level map | `ui/screens/LevelMapScreen.tsx` | `FlatList` of rows of 5 with `getItemLayout` and an initial scroll to the next level; only a window is mounted, so 10000 levels stay cheap. |
| Components | `ui/components/Button`, `Screen` | Accessible controls (role, label, 48 pt minimum target). |

## Screen flow
Splash (0.8 s) -> Home (coins, Continue, Play, Settings) -> Level Map -> Game -> Result (stars, score, coins; Next level, Try again, Level map, Home). Settings toggles sound and haptics, persisted.

## Behaviour notes
- A Game screen only navigates to Result after it has seen the session enter `playing` itself, so a stale result from an earlier run cannot bounce a fresh Try again.
- Rejected taps (covered tile) change nothing; feedback for them arrives with animation in Phase 7.
- The level source is `GeneratedLevelSource`. Hand-made levels plug in later through `AuthoredLevelSource` and a loader, with no UI change.

## Tests
Controller (win, loss, restart, stale loads, load failure, rewards and progress, analytics), stores, analytics, i18n, tile art coverage of all 30 types, board geometry, and screen tests through the real app container: Splash to Home, Level Map windowing and locking, playing a level to the Result screen, replay pays no extra coins, Settings persistence.
