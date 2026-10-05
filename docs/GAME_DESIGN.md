# Tile Match Puzzle - Game Design Document (Phase 0)

Status: APPROVED (Phase 0 complete). Governed by [PROJECT_RULES.md](../../PROJECT_RULES.md).

## 1. Architecture Explanation

Two strictly separated layers (Rules 2 and 3):

| Layer | Tech | Responsibility |
|---|---|---|
| Game Engine | Pure TypeScript, no React / RN / MMKV imports | Rules, state transitions, scoring, level loading and generation |
| UI / App | React Native + TS, Zustand, Reanimated | Rendering, input, animation, audio, persistence, network, ads, IAP |

Communication is one-way through a narrow interface: the UI sends **commands** to the engine and receives **events** and immutable state snapshots back. The engine never knows the UI exists.

Every outside service sits behind an interface the engine or app depends on (Dependency Inversion, Rule 8): `IStorage`, `ILevelSource`, `IRandom`, `IClock`, `IAnalytics`, `IAdService`, `IPurchaseService`, `ICloudSaveService`, `ILeaderboardService`. This is what keeps the Rule 9 features additive rather than rewrites.

### Future-support hooks designed in from day one (Rule 9)

| Requirement | Design decision made now |
|---|---|
| 10000 levels | Levels are data (JSON), loaded lazily by id via `ILevelSource`. Beyond authored levels, `LevelGenerator` produces levels deterministically from `(levelId, seed)`. No level list is held in memory. |
| Multiplayer | Engine is deterministic: same level + same seed + same command sequence = same result. Commands are serializable, so they can be sent, replayed and validated server-side. |
| Leaderboard | Score is computed only in the engine from the command log, so it can be verified server-side (`verifyRun`, Phase 11). |
| Cloud save | Player progress is one versioned, serializable schema, separate from persistence. Includes `schemaVersion` and `updatedAt` for merge and conflict resolution. |
| Ads | Ads sit behind `IAdService`. The engine emits `LEVEL_COMPLETED` / `GAME_OVER`; the UI decides whether to show an ad. Boosters can be granted by rewarded ad through a generic "grant" path. |
| In-App Purchase | Coins and boosters are a generic `Wallet` / `Inventory` model. `IPurchaseService` only credits the wallet, and the engine is untouched. |

## 2. Game Concept

Layered-tile matching puzzle (Triple-Tile style). Tiles are stacked in overlapping layers on a board. The player taps free tiles to move them into a tray. Three identical tiles in the tray clear. The player wins by clearing the board and loses if the tray fills up.

## 3. Rules

1. The board holds N tiles, in layers. Every tile type appears in multiples of 3.
2. A tile is **free** if no tile in a higher layer overlaps it. Only free tiles can be selected.
3. Tapping a free tile moves it to the **tray**. The tray has **7 slots**.
4. Tiles enter the tray grouped next to a same-type tile if one exists, otherwise at the end.
5. When **3 tiles of the same type** are in the tray, they are matched and removed. Remaining tiles shift left.
6. Removing a tile from the board may free the tiles beneath it.

### Win / Lose

- **Win:** the board has no tiles left and the tray is empty (no matches are possible to leave tiles behind, since counts are multiples of 3).
- **Lose:** the tray holds 7 tiles with no match available after a selection.
- Lose can be softened by a "revive" (clear 3 tray slots) through coins or a rewarded ad (Phase 12).

## 4. Board and Tiles

| Item | Value |
|---|---|
| Board coordinate space | Logical grid 8 columns x 10 rows, half-cell offsets allowed for overlap |
| Layers | 1 to 6 depending on difficulty |
| Tiles per level | 18 to 150 (always divisible by 3) |
| Tile types | 30 total in the base set; a level uses 4 to 20 of them |
| Tile identity | `id` (unique per instance) and `typeId` (matching key). Art is resolved by the UI from `typeId`, never by the engine. |
| Tray | 7 slots |

## 5. Scoring

| Event | Points |
|---|---|
| Tile selected | 10 |
| Match of 3 | 100 |
| Combo (match within 3 selections of the previous match) | +50 x combo level, capped at x5 |
| Level clear bonus | 50 per unused tray slot |

Stars are awarded from the final score against per-level thresholds stored in level data:

- 1 star: level cleared
- 2 stars: score >= `twoStarScore`
- 3 stars: score >= `threeStarScore` (and no booster used, optional per level)

Coins on clear: 10 + 5 per star.

## 6. Difficulty Levels

Difficulty is configuration, not code. A `DifficultyConfig` is applied by `LevelGenerator` and validated by `LevelValidator`.

| Tier | Levels (default curve) | Tile types | Tiles | Layers | Notes |
|---|---|---|---|---|---|
| Tutorial | 1-10 | 3-4 | 18-30 | 1-2 | Guided, hard to lose |
| Easy | 11-100 | 4-8 | 30-60 | 2-3 | |
| Medium | 101-500 | 8-12 | 60-90 | 3-4 | |
| Hard | 501-2000 | 12-16 | 90-120 | 4-5 | |
| Expert | 2001-10000+ | 16-20 | 120-150 | 5-6 | Every 10th level is a "boss" with a high type count |

Difficulty knobs: number of types, tile count, layer count, overlap density, and whether the level is guaranteed solvable with margin (`solvabilitySlack`, the spare tray slots needed in the worst case).

Every generated level must pass a solvability check in `LevelValidator` before it is accepted.

## 7. Boosters (implemented in Phase 10)

Details in [PHASE_10_ARCHITECTURE.md](PHASE_10_ARCHITECTURE.md).

- **Undo:** takes back the last selection, including a match it caused, and restores the score and combo. Can be used repeatedly; cannot go back past a shuffle. Implemented as `UNDO`.
- **Shuffle:** re-deals which picture sits on which remaining tile, keeping the layout. It is seeded (so replays match) and never makes a winnable game unwinnable. Implemented as `SHUFFLE` with a seed.
- **Hint:** highlights a free tile that starts a winning line. It changes nothing, but is recorded as `HINT` so the "no boosters" star rule can be verified from the log.
- **Getting them:** one of each after the tutorial; otherwise from stock, or bought with coins on the spot (Hint 20, Undo 30, Shuffle 40 - to be tuned). Rewarded ads and purchases (Phases 12 and 13) credit the same wallet.
- Boosters are unavailable while a tutorial step is showing. A booster that cannot do anything right now is not charged.

## 8. Themes

A theme is a `themeId` on the level. The engine carries it as an opaque string. The UI maps it to art, colors and music.

## 9. Screens (Phase 6 preview)

Splash, Home, Level Map, Game, Result, Settings.

## 10. Finalized Decisions

| # | Decision | Status |
|---|---|---|
| 1 | Tray size 7, match size 3 | Approved |
| 2 | Difficulty tiers and tile counts as in section 6 | Approved |
| 3 | Scoring table as in section 5 | Approved |
| 4 | Revive on lose (by coins or rewarded ad), implemented in Phase 12 | Assumed, see note |
| 5 | Platforms: Android and iOS (one React Native codebase) | Assumed, see note |
| 6 | Section 13: combo, stars, solvability, tutorial, save state, testing, analytics | Approved |

Note: decisions 4 and 5 were not answered explicitly. They were recorded as the defaults implied by the approval and can be changed before Phase 1 code is written. Changing them later costs more.

Change log:
- Draft 1: initial design.
- Draft 2: approved; open questions converted to decisions.
- Draft 3: added section 13 (combo, stars, solvability, tutorial, save state, testing, analytics) as PROPOSED defaults, and [ROADMAP.md](ROADMAP.md).
- Draft 8: cloud merge and leaderboard verification (13.6) implemented in Phase 11, provider-agnostic; no backend connected yet.
- Draft 7: boosters (section 7) implemented in Phase 10; `booster_used` event; starter boosters after the tutorial.
- Draft 6: save state (13.6) implemented in Phase 9: progress schema v2, saved game and resume, `level_resume` event.
- Draft 5: tutorial (13.5) implemented in Phase 8; added `tutorial_skip` event.
- Draft 4: section 13 approved. Added clarifications 13.9 (clear bonus and coin wording) found while implementing Phase 3.

## 11. Phase 0 Testing Approach

Phase 0 produces no code, so there are no unit tests. The design is validated by review. Every rule above becomes a test case in Phase 5 (board loading, selection, match detection, removal, scoring, win/lose).

## 12. Next Phase

See [ROADMAP.md](ROADMAP.md). Phases 1 and 2 are done ([PHASE_1_ARCHITECTURE.md](PHASE_1_ARCHITECTURE.md), [PHASE_2_ARCHITECTURE.md](PHASE_2_ARCHITECTURE.md)). Phase 3 (scoring) is next and depends on section 13.

## 13. Approved Decisions (Phase 2 follow-up)

Status: APPROVED. Numbers marked "tune" are starting values to adjust from playtest data.

### 13.1 Combo rule

- The engine counts **accepted selections**. A rejected command does not count.
- After a match at selection `m`, the next match keeps the combo alive if it happens at selection `m + 3` or earlier. Selections that do not match count toward those 3 but do not by themselves reset the combo.
- Combo level: the first match is level 0 (no bonus). Each chained match is previous level + 1. Bonus is `50 x level`, level capped at 5 (max +250).
- If 3 selections pass with no match, the combo resets to 0.
- One selection can cause at most one match, so a combo advances by at most 1 per selection.
- Undo restores the combo counter along with the rest of the state (implemented in Phase 10): the score remembers its state before each selection and returns to it.

### 13.2 Star system

- Base reference score per level: `ref = 10 x N + 100 x (N / 3)` where N is the tile count (no combos, no clear bonus).
- Handcrafted levels store `twoStarScore` and `threeStarScore` in level data. Generated levels use `twoStarScore = ceil(1.2 x ref)` and `threeStarScore = ceil(1.6 x ref)` (tune). Reaching them requires combos.
- 1 star: level cleared. 2 stars: score >= `twoStarScore`. 3 stars: score >= `threeStarScore`, and, if the level sets `noBoosters: true`, no booster used.
- Coins on clear: 10 + 5 per star, granted once per star improvement (replaying for the same stars pays 0).
- Stars and score are computed from the command log only, so a server can recompute them.

### 13.3 Solvability

- A level is **solvable** if some sequence of selections reaches `won`.
- A level has **slack `s`** if a winning sequence exists in which the tray never holds more than `7 - s` tiles.
- Required slack by tier (tune): Tutorial 3, Easy 2, Medium 1, Hard 0 to 1, Expert 0. Boss levels may use 0.
- `LevelValidator` searches for a winning sequence using depth-first search with memoization on (remaining tile set, tray contents), ordered by a heuristic that prefers tiles completing a triple. It has a node budget. **If the budget is exhausted the level is rejected**, never assumed solvable.
- Validation runs **offline** in tooling and CI, never on the device. Accepted levels store `validatedSlack` in their data.
- `LevelGenerator` builds levels by **reverse play**: it places tiles in a valid removal order, which makes them solvable by construction. The validator then confirms slack.

### 13.4 Level data (impact)

Level JSON carries: `levelId`, `schemaVersion`, `themeId`, tiles, `twoStarScore`, `threeStarScore`, `noBoosters?`, `validatedSlack`, `tutorial?`. Phase 4 finalizes the schema.

### 13.5 Tutorial (levels 1 to 10)

- Data-driven and UI-side. The engine rules are unchanged; the only engine change is an optional `tutorial` list on the level data (schema v1, additive).
- A step is `{ highlightTileIds, messageKey, waitFor }`. `waitFor: "select"` accepts only the highlighted tiles; `waitFor: "tap"` shows a message and locks the board until "Got it". Text is referenced by key, so localization needs no code changes.
- Ten fixed authored levels within the approved tutorial tier (3 to 4 types, 18 to 30 tiles, 1 to 2 layers), verified with slack 3:

| Level | Lesson |
|---|---|
| 1 | Tap a tile; three of a kind vanish |
| 2 | Different pictures wait side by side in the tray; a third completes the set |
| 3 | Covered tiles cannot be tapped; clearing the top frees what is underneath |
| 4 | The tray holds 7 tiles and how to avoid filling it |
| 5 | Layers: start from the top |
| 6 | Plan ahead: pick tiles that uncover more matches |
| 7 | Quick matches build a combo |
| 8 | Stars and bonus points |
| 9 | Preview of boosters (none are granted before Phase 10) |
| 10 | Ready; finishing it completes the tutorial |

- A wrong tap during a `select` step is ignored with a hint (not counted as a rejected move). Guidance covers only the first moves of each level; the rest is free play.
- Completion is stored in progress (`tutorialCompleted`). It is set by clearing level 10 or by "Skip tutorial". Saves from before the tutorial existed count as completed once level 11 is unlocked.
- "Replay tutorial" in Settings opens level 1 guided again, and Next level / Try again stay guided until level 10.
- Analytics: `tutorial_step` (each finished step) and `tutorial_skip`.

### 13.6 Save state

Two separate persisted documents, both versioned and stored through `IStorage`. Implemented in Phase 9; details in [PHASE_9_ARCHITECTURE.md](PHASE_9_ARCHITECTURE.md).

**`PlayerProgress`** (cloud-syncable), current schema version 2
- `schemaVersion`, `updatedAt`
- `highestUnlockedLevel`
- `levels`: sparse map of `levelId -> { stars, bestScore }`. Only cleared levels are stored, so 10000 levels cost nothing.
- `wallet` (`{ coins }`), `inventory` (booster counts, empty until Phase 10), `tutorialCompleted`.
- Migrations upgrade older versions one step at a time on load (version 1 -> 2 moved `coins` into `wallet` and added `inventory`). Loading never writes; the upgraded document is saved on the next save.
- Unreadable data (corrupt, or written by a newer app) falls back to safe defaults. The original text is copied to a backup key just before the first save that would replace it, so nothing is lost silently.

**`InProgressGame`** (device-local, not synced), schema version 1
- `schemaVersion`, `levelId`, `levelContentVersion` (a fingerprint of the level's tiles), `commands`.
- Saved after every accepted command, cleared on win, loss, Quit and Restart. Closing or killing the app keeps it; Home then offers "Resume - Level N".
- Resume reloads the level, checks the fingerprint, and replays the commands through `GameEngine` on a fresh engine. Any mismatch, rejected command or already-finished game discards the save and starts the level fresh.
- Tutorial guidance is not resumed mid-way.

**Cloud merge (implemented in Phase 11):** `highestUnlockedLevel` takes the max. Per-level `stars` and `bestScore` take the max, level by level. `tutorialCompleted` is true if either side is. Wallet and inventory come together from the document with the newer `updatedAt` (ties broken by coins, then inventory, so the result never depends on order), until a transaction ledger exists. The merge is commutative, associative and idempotent, so devices converge whatever order they sync in. Sync uses optimistic concurrency (a revision per save), never overwrites data it cannot read, and does not push when the cloud already has the same content. Details in [PHASE_11_ARCHITECTURE.md](PHASE_11_ARCHITECTURE.md).

**Leaderboard (implemented in Phase 11):** per level, best score per player. The client submits the whole command log; the server replays it with the engine's `verifyRun` and takes the score from that. Boosters used are counted from the log.

### 13.7 Testing strategy

| Layer | Tool | What | Gate |
|---|---|---|---|
| Engine unit | Jest (Node) | Each rule, edge case, rejection | Line coverage >= 90% for `src/engine` |
| Engine property / replay | Jest | Random legal play never breaks invariants (tile conservation, tray <= 7, multiples of 3); replay equals live state | Every PR |
| Level validation | Jest / script | Every shipped level passes schema and solvability | CI on any level change |
| Services and stores | Jest with fakes | `IStorage` contract on MMKV and in-memory; store persistence and migrations | Every PR |
| Purity | Jest and ESLint | Engine imports nothing outside itself | Every PR |
| UI | React Native Testing Library | Screens render, navigation flow, store wiring | Every PR |
| Device smoke | Maestro on an Android emulator | Launch, play a level, restart app and check saved state | Before each release |

CI on every PR: `tsc` (app and engine configs), ESLint, Jest with coverage.

### 13.8 Analytics plan

- `IAnalytics { track(name, params) }`, implemented by `NoopAnalytics` until a backend is chosen (Phase 13). Events are derived in the **app layer** from engine events; the engine never calls analytics.
- Events: `app_open`, `level_start`, `level_complete` (levelId, stars, score, moves), `level_fail` (levelId, peakTray, remainingTiles), `tutorial_step`, `tutorial_skip`, `level_resume`, `booster_used` (levelId, booster, paidWith), `revive_used`, `ad_shown`, `ad_rewarded`, `iap_purchase`.
- No personal data in events. Sending is gated on user consent (Phase 12).
- Purpose: find levels with unusual fail rates to retune difficulty and slack.

### 13.9 Clarifications made during Phase 3 (need a quick confirm)

1. **Level clear bonus.** Section 5 says "50 per unused tray slot". A level can only be won with an empty tray, so "unused at the end" would always be 7 slots (a constant 350) and reward nothing. Implemented as **unused at peak**: `50 x (7 - peakTrayOccupancy)`, where peak occupancy is the most tiles the tray held at any point (counted right after a tile is inserted, before a match is removed). Peak 7 gives 0, peak 3 gives 200. This rewards safe play and is derived from engine events only.
2. **Coin wording.** "10 + 5 per star, granted once per star improvement" is implemented as: first clear pays `10 + 5 x stars`; a later replay that improves stars pays `5 x (newStars - bestStars)`; a replay with no improvement, or a loss, pays 0.
3. **Combo level cap.** The combo level is capped at 5, so the largest combo bonus is 250.
