# Phase 8 Architecture - Tutorial (levels 1 to 10)

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Implements GAME_DESIGN 13.5. The engine rules are untouched; the only engine change is one optional data field.

```
level data (tutorial steps) --> GameController --> tutorial store --> TutorialCoach + rings (UI)
                                     |  gate: only highlighted tiles may be tapped during a "select" step
                                     +-- progress.tutorialCompleted (skip, or clear level 10)
```

## Data
`LevelData.tutorial?: TutorialStep[]` (schema v1, additive). A step is `{ highlightTileIds, messageKey, waitFor }`:
- `waitFor: 'select'`: the player must tap one of the highlighted tiles. Nothing else can be tapped.
- `waitFor: 'tap'`: the player reads a message and presses "Got it". The board is locked meanwhile; highlighted tiles are shown as illustration.
- `messageKey` is a key into the string table, so translation needs no code change. The engine treats it as an opaque string.

`parseLevelData` validates steps: known `waitFor`, non-empty key, every highlighted id exists, and a `select` step names at least one tile.

## Content
| File | Role |
|---|---|
| `services/levels/levelDsl.ts` | Builds a level from text grids (one letter per tile type, `.` for empty, one grid per layer, optional half-cell offset). Steps refer to tiles by (layer, row, column), so nobody hand-counts ids |
| `services/levels/tutorialLevels.ts` | The 10 fixed levels and their steps |
| `services/levels/createLevelSource.ts` | Tutorial levels first (through `AuthoredLevelSource`, so they are parsed and validated like any authored level), generated levels for everything else |

All ten follow the approved tier table: 3 to 4 types, 18 to 30 tiles, 1 to 2 layers, slack 3.

| Level | Lesson |
|---|---|
| 1 | Tap a tile; three of a kind vanish |
| 2 | Different pictures wait side by side in the tray; a third completes the set |
| 3 | Covered tiles cannot be tapped; clearing the top frees the ones underneath |
| 4 | The tray holds 7; how to avoid filling it |
| 5 | Layers: start from the top |
| 6 | Plan ahead: pick tiles that uncover more matches |
| 7 | Quick matches build a combo |
| 8 | Stars and bonus points |
| 9 | Preview of boosters (none are granted before Phase 10) |
| 10 | Ready: finishing it completes the tutorial |

## Behaviour
- Guidance is on for a level that has steps when the tutorial is not completed, or when the player replays it from Settings. The flag travels through the Game and Result screens so Next level and Try again stay guided during a replay.
- Wrong taps during a `select` step are ignored and show a hint; they are not "rejected" moves, so there is no error sound or shake.
- Restarting a guided level restarts its steps.
- Skip tutorial marks it completed. Winning level 10 also completes it. Progress saved before this phase counts as completed when level 11 was already unlocked.
- Analytics: `tutorial_step` (each finished step) and `tutorial_skip`.

## Tests
Parser rules for the new field; the level builder; all ten levels parse, obey the tier limits, and pass the solver at slack 3; a walk-through of every level's steps on a real engine (each highlighted tile is free and accepted, the tray stays within 4); string keys all exist; store and controller gating, advance, skip, replay and restart; screen flow through the real app including the coach panel, Got it, Skip, wrong-tap hint, replay from Settings and completion at level 10.
