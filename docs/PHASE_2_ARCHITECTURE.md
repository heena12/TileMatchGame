# Phase 2 Architecture - Core Game Engine

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md) and [GAME_DESIGN.md](GAME_DESIGN.md) sections 2-4.

Scope: pure TypeScript engine core. No scoring (later), no level loading or generation (Phase 4), no boosters (Phase 10), no UI.

## Design

State is immutable data. Behavior is pure functions. A thin facade owns the current state.

```
UI --command--> GameEngine.dispatch --> applyCommand(state, cmd) --> { state', events }
                     |                         uses board.ts, tray.ts
                     +-- command log (accepted commands only)
```

| File | Responsibility |
|---|---|
| `core/types.ts` | `TileSpec`, `LevelDefinition`, `GameState`, `GameStatus` |
| `core/rules.ts` | `TRAY_SIZE = 7`, `MATCH_SIZE = 3` |
| `core/board.ts` | `overlaps`, `isFree`, `getFreeTiles` |
| `core/tray.ts` | `insertTile` (group with same type), `extractMatch` |
| `core/level.ts` | `validateLevel`, `createInitialState`, `LevelValidationError` |
| `core/reducer.ts` | `applyCommand`: the only place state transitions happen |
| `commands/commands.ts` | `SelectTileCommand` (serializable) |
| `events/events.ts` | `TILE_SELECTED`, `TILES_MATCHED`, `LEVEL_COMPLETED`, `GAME_OVER`, `COMMAND_REJECTED` |
| `GameEngine.ts` | Facade: `dispatch`, `getState`, `getFreeTileIds`, `getCommandLog`, `replay` |

## Rules implemented

1. A tile occupies a 1x1 cell at `(x, y)` on a `layer`. Half-cell offsets allowed, so tiles overlap when `|dx| < 1` and `|dy| < 1`.
2. A tile is free when no tile on a higher layer overlaps it.
3. Selecting a free tile moves it to the tray, placed after the last tile of the same type, else at the end.
4. Three tiles of one type in the tray are removed; the rest shift left.
5. Win: board and tray empty. Lose: tray holds 7 tiles after resolving matches.
6. Invalid commands (blocked, unknown tile, game over) leave state unchanged and emit `COMMAND_REJECTED`.

## Level validation (fail fast)

Non-empty, unique tile ids, each type count a multiple of 3, no two tiles overlapping on the same layer.

## Future support

- Determinism (multiplayer, leaderboard): no randomness or clock in the core. Same level + same accepted command log = same state. `GameEngine.replay` proves it.
- Serializable commands and events: can be sent to and verified by a server.
- 10000 levels: the engine takes one `LevelDefinition` at a time; it never holds a level list.
- Scoring will be added as a pure function over events, so it stays verifiable from the command log.

## Tests

Board freedom and overlap, tray insertion and matching, level validation, reducer transitions (select, match, win, lose, rejections), immutability of previous state, replay determinism.
