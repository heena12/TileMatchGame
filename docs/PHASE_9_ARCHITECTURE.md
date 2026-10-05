# Phase 9 Architecture - Progress, Save Migrations and Resume

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Implements GAME_DESIGN 13.6. Cloud merge is Phase 11.

Two separate persisted documents, both versioned and both stored through `IStorage`:

| Document | Key | Synced later? | Purpose |
|---|---|---|---|
| `PlayerProgress` | `player.progress` | Yes (Phase 11) | What the player has achieved |
| `InProgressGame` | `game.inProgress` | No, device-local | The level being played right now |

## Versioned documents and migrations
`state/persistence/migrations.ts` is a small generic runner shared by both documents:

```
raw text --> parse --> version check --> step v -> v+1 -> ... -> current --> sanitize --> state
              |             |                 |
           corrupt        future        missing step / step throws = corrupt
```
- **none**: nothing stored yet. **corrupt**: not JSON, not an object, or an invalid version. **future**: written by a newer app.
- A migration step only upgrades one version; the runner stamps the new `schemaVersion`.
- After migration the document is *sanitized* field by field. A bad field falls back to its default; it never rejects the whole document.
- Loading never writes. A migrated document is saved in its new form the next time the player earns something.

### PlayerProgress v2 (v1 -> v2 is the first real migration)
`{ schemaVersion, updatedAt, highestUnlockedLevel, levels (sparse), wallet: { coins }, inventory (booster counts), tutorialCompleted }`.
- v1 -> v2 moves `coins` into `wallet` and adds an empty `inventory`. It also folds in the Phase 8 rule that a save already past level 10 counts as having finished the tutorial.
- `inventory` is empty until Phase 10 adds boosters; the shape is fixed now so that phase needs no migration.
- **Nothing is lost silently.** If the stored text is corrupt or from a newer app, the game runs on defaults, and the original text is copied to `player.progress.backup` just before the first save that would overwrite it.

### InProgressGame v1
`{ schemaVersion, levelId, levelContentVersion, commands }`.
- Saved after every accepted command. Rejected taps are not saved. Cleared on win, on loss and on **Quit**. Closing or killing the app keeps it.
- `levelContentVersion` is a fingerprint of the level (id and every tile's id, type, position and layer). If a level's content changes, or a generator change alters it, the saved game is discarded rather than replayed onto a different board.
- **Resume** reloads the level, verifies the fingerprint, and replays the commands through `GameEngine` on a fresh engine. The engine is deterministic, so this rebuilds the exact board and tray; scoring and combo are rebuilt by folding the same events. Any rejected command, a finished game, or a mismatch discards the save and starts the level fresh.
- Tutorial guidance is not resumed mid-way. A resumed guided level plays as normal; the tutorial can be replayed from Settings.

## UI
Home shows **Resume - Level N** when a saved game exists. Restart and Try again always start fresh.

## Analytics
`level_resume` (levelId, moves already made).

## Tests
Migration runner (every outcome), progress v1 -> v2 and sanitizing, backup on first save after corrupt or future data, fingerprint, saved-game store, controller save/clear/resume rules and every discard path, and a whole-app flow: play, close the app, reopen, resume, finish.
