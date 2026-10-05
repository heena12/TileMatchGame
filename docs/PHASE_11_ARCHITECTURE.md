# Phase 11 Architecture - Cloud Save and Leaderboard

Governed by [PROJECT_RULES.md](../PROJECT_RULES.md). Implements GAME_DESIGN 13.6 (cloud merge) and the leaderboard requirement of section 1.

## Scope, honestly
No backend is connected. Choosing one (Firebase, PlayFab, Supabase, a custom server) is a product decision. This phase builds everything that does **not** depend on that choice, fully tested, so connecting a provider later means writing two small adapters and nothing else:

| Built and tested here | Left for the provider |
|---|---|
| Merge rules for progress (pure) | Storing and returning an opaque text blob per player, with a revision |
| Server-side verification of a run (`verifyRun`, pure) | Sign-in / player identity |
| `ICloudSaveService` and `ILeaderboardService` interfaces | Hosting, auth, rate limits, anti-abuse beyond replay |
| Sync engine with conflicts, offline handling, retries | |
| Persisted retry queue for leaderboard submissions | |
| `InMemoryBackend`: a reference server used by every test, including two simulated devices | |

Until a provider exists the app uses `NoopCloudSave` and `NoopLeaderboard`; Settings says "Cloud save is not connected" and no leaderboard button appears.

## Merge rules (design 13.6) - `mergeProgress`
| Field | Rule |
|---|---|
| `highestUnlockedLevel` | larger wins |
| each level's `stars` and `bestScore` | larger wins, level by level |
| `tutorialCompleted` | true if either is true |
| `wallet` and `inventory` | taken together from the document with the newer `updatedAt` (ties broken by coins, then inventory, so the result never depends on argument order) |
| `updatedAt` | larger wins |

It is commutative, associative and idempotent (property-tested), so devices converge whatever the order of syncing. **Known limitation, as designed:** wallet and inventory follow "newest wins" until a transaction ledger exists, so coins earned on a device whose last change was older can be overwritten. Taking the larger value instead would let a spent coin come back, which is worse.

## Sync (`SyncService`)
```
pull remote  -->  merge into local  -->  push merged (with the revision we pulled)
                                            |
                                   conflict? re-pull and repeat (up to 3 times)
```
- The cloud stores an opaque text blob plus a revision. A push succeeds only if it names the current revision; otherwise the server returns the current snapshot, which the client merges and retries. This is optimistic concurrency: two devices can never silently overwrite each other.
- Remote data is untrusted: it goes through the same version check, migrations and field-by-field cleanup as local data. An unreadable remote is never overwritten; a remote from a newer app shows "update the app".
- No pointless traffic: if the merged result equals what is already in the cloud, nothing is pushed.
- Offline or failing calls leave local data untouched and set the status to offline; the next trigger retries.
- Triggers: app start, a debounced sync after progress changes (a merge coming *from* the cloud does not re-trigger), and "Sync now" in Settings. Concurrent requests share one run.

## Leaderboard
- **The client sends the run, not a score.** A submission is the level id, the level's content fingerprint, the full command log, and the claimed score and stars.
- **`verifyRun` (engine, pure)** is what a server calls. It replays the log through the real engine and accepts only if: the level matches (id and fingerprint); no command is rejected; the game was actually won; and the recomputed score and stars equal the claims. The log includes Undo/Shuffle/Hint, so boosters are counted too. It returns the trusted score, stars, moves and boosters used.
- Ranking per level: score high to low, then fewer moves, then earlier. Each player keeps their best.
- **`RunReporter`** queues submissions on the device (persisted, one per level - the best, at most 50) and sends them when it can. A rejected submission is dropped; a network failure keeps it for later. Only a new personal best is queued.

## App wiring
`GameController` reports a finished win (with its log) through an optional callback; the container connects it to the reporter. Screens use `useSync` and `useLeaderboard`. Settings gets a cloud section; Result gets a Leaderboard button when a service is connected; a new Leaderboard screen lists the top entries for a level.

## Tests
Merge properties and rules; `verifyRun` against every kind of tampering; the reference backend; sync between two devices (convergence, offline both sides, conflicts, corrupt and newer-app remote, debounce, no loops, shared runs); the reporter (offline, rejection, dedupe, cap, persistence); a real controller run verified by the server; screens.
