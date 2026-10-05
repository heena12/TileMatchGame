# Roadmap

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Rule 5: one phase is completed and approved before the next starts. Rule 4: every phase delivers architecture note, files, code and unit tests.

Design decisions referenced here live in [GAME_DESIGN.md](GAME_DESIGN.md).

| # | Phase | Delivers | Status |
|---|---|---|---|
| 0 | Game design | `GAME_DESIGN.md` | Done |
| 1 | Project setup | RN + TS app, navigation, Zustand, MMKV service, engine boundary enforced by lint and test | Done |
| 2 | Engine core | Board, free tiles, tray, matching, win/lose, commands, events, `GameEngine` facade, replay | Done |
| 3 | Scoring | Score, combo, clear bonus, stars, coins as pure functions over engine events. Verifiable from the command log | Done |
| 4 | Levels | Level JSON format and schema version, `ILevelSource` implementation (lazy by id), `DifficultyConfig`, `LevelGenerator`, `LevelValidator` with solvability check | Done |
| 5 | Engine test suite | Every rule in the design as a test, property tests (random play never breaks invariants), replay determinism, all shipped levels validated in CI | Done |
| 6 | Screens | Splash, Home, Level Map (virtualized for 10000 levels), Game (rendering only), Result, Settings. `IAnalytics` interface and events wired | Done |
| 7 | Animation and audio | Reanimated tile-to-tray, match, win/lose; `IAudio`; haptics | Done |
| 8 | Tutorial | Levels 1-10 guided flow (see design section 13.5) | Done |
| 9 | Progress and save | `PlayerProgress`, in-progress game resume, migrations (see design section 13.6) | Done |
| 10 | Boosters and wallet | Undo, Shuffle, Hint; `Wallet` and `Inventory` | Done |
| 11 | Cloud save and leaderboard | `ICloudSaveService`, merge rules, `ILeaderboardService`, server-side replay verification | Done (no backend connected, see open items) |
| 12 | Revive, lives and ads | Revive, `IAdService`, rewarded grants, consent flow | |
| 13 | In-app purchase and native SDKs | `IPurchaseService`, store SDK integration, analytics backend | |
| 14 | Release hardening | Release signing, CI/CD, performance pass, accessibility, localization, store compliance | |

## Phase exit criteria (every phase)

1. `tsc`, ESLint and Jest all pass.
2. Engine purity test passes (Rules 2 and 3).
3. Architecture note, file list and testing steps delivered.
4. Approval received before the next phase starts.

## Cross-cutting tracks

| Track | Introduced | Notes |
|---|---|---|
| Testing strategy | Phase 2 | Design section 13.7 |
| Analytics | Phase 6 | Design section 13.8 |
| Performance (150-tile boards) | Phase 6, gated in 14 | Target 60 fps on a mid-range Android device |
| Accessibility and localization | Phase 6, finished in 14 | Colour-blind-safe tile art, text scaling, string tables from day one |
| Privacy and consent | Phase 12 | GDPR / ATT before any ad or analytics SDK initializes |

## Open items

- **Choose and connect a backend provider** (Firebase, PlayFab, Supabase, or a custom server). Phase 11 is finished except for this. It needs two adapters implementing `ICloudSaveService` and `ILeaderboardService`, sign-in for a player identity, and a server that runs `verifyRun` on submitted runs. Until then Settings shows "Not connected yet" and the Leaderboard button is hidden.

- Phase 1 Definition of Done requires a device run. The Android build has not completed on the dev machine yet. Track it as a blocker for trusting native packages.
- Design section 13 is approved. The three clarifications in 13.9 (clear bonus at peak, coin wording, combo cap) need a quick confirm.
