# Phase 10 Architecture - Boosters and Wallet

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Implements GAME_DESIGN section 7 and the wallet/inventory model of section 1. Unlike earlier phases this one changes the engine, because Undo and Shuffle change the game.

## The three boosters

| Booster | What it does | In the engine |
|---|---|---|
| **Undo** | Takes back the last selection, including any match it caused. Can be used repeatedly. Cannot go back past a shuffle | `UNDO` command; a history of the game before each selection |
| **Shuffle** | Re-deals which picture sits on which remaining tile. Positions, layers and the number of tiles of each picture stay the same | `SHUFFLE` command carrying a seed |
| **Hint** | Points at a free tile that starts a winning line | `getHint()` (read-only) and a `HINT` command that changes nothing |

All three are engine commands, so they are in the command log, replay identically, and can be checked by a server.

### Design decisions that matter
- **Undo restores the score, combo included** (design 13.1). `ScoreState` remembers the state before each selection; `SELECTION_UNDONE` returns to it. A shuffle clears that memory, exactly as it clears the engine's undo history. A property test keeps the two in step through random play.
- **Shuffle is deterministic.** The seed is part of the command, so replaying a log, resuming a saved game, or verifying on a server gives the identical board.
- **Shuffle never makes a winnable game unwinnable.** It reuses the generator's "winnable deal": it takes a random valid order of removing the tiles and hands out pictures along it so that order is a winning play, counting the tiles already waiting in the tray. Only if the tray is already too full for any winning deal does it fall back to a plain shuffle.
- **Hint is a search, not a guess.** It looks for a winning line from the current position and suggests its first tile, so following hints wins whenever the level is still winnable. Without a winning line it falls back to a rule of thumb (a tile that completes a set, else joins one).
- **Hint is logged.** It changes nothing, but the log records that a booster was used, so the "no boosters" star rule (design section 5) is computed from the log alone. `evaluateCommandLog` now counts boosters itself.
- **Rejected boosters cost nothing** and are not logged or counted.

### Moved into the engine core
The type-dealing code and the solver moved from `levels/` into `core/` (the old paths still re-export them), because Shuffle and Hint need them and `core` must not depend on `levels`. The generator calls the moved code with the same random-number sequence: a regression test pins the fingerprints of eighteen generated levels, recorded before the move, so generated levels (and everyone's saved games) are unchanged.

## Wallet and inventory
`progressStore` gains one generic way in and one way out:
- `credit({ coins?, boosters? })`: rewarded ads and in-app purchases (later phases) will only ever call this, so the rules never know where a reward came from. Negative or fractional amounts are ignored.
- `payForBooster(kind)`: uses one from stock; if none, spends the price in coins; otherwise refuses and changes nothing.
- Prices (`config/boosters.ts`): Hint 20, Undo 30, Shuffle 40 coins (tune with playtest data).
- **Starter boosters:** one of each, given once when the tutorial is finished or skipped.

## Using a booster (GameController.useBooster)
1. Refuse if no game is running (`not_possible`), a tutorial step is showing (`locked`), or the player can neither use stock nor afford the price (`unavailable`).
2. Refuse if it would do nothing right now (nothing to undo, one picture left, no hint): `not_possible`, not charged.
3. Dispatch the command; update the game, score, sound and haptics; save the game; **then** charge. A crash in between never charges for nothing.
4. Report `booster_used` to analytics (which booster, and whether stock or coins paid).

## UI
The booster bar keeps the placeholder's look (round buttons with a badge). A badge shows how many are in stock, or the price in coins when none are; a button that would do nothing is dimmed. A press that cannot work shows a short reason ("Not enough coins", "Nothing to undo yet", ...) and costs nothing. Hint draws a pulsing ring on the suggested tile until the next move.

## Saving and resuming
Undo, Shuffle and Hint are stored in the saved game like any command. Resume replays them, including the seeded shuffle. Booster stock and coins are saved with the progress at the moment of use.

## Tests
Engine: undo (all cases), shuffle (structure, determinism, winnability including with tiles in the tray, fallback), hint (including that following hints wins), dealing and the moved modules, the solver from a partly played position, scoring across undo/shuffle, log replay with boosters, and 30 random games mixing every booster with invariant checks after each operation. State: wallet, pricing, starter grant, every controller outcome, stars, resume. UI: the bar, each booster, messages, locking during the tutorial, persistence.
