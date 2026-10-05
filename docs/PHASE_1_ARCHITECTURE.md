# Phase 1 Architecture - React Native Project Setup

Status: PROPOSED, awaiting approval. Governed by [PROJECT_RULES.md](../../PROJECT_RULES.md) and [GAME_DESIGN.md](GAME_DESIGN.md).

Scope: project skeleton and tooling only. No game logic (Phase 2), no real screens (Phase 6).

## 1. Goals

1. A React Native + TypeScript app that builds and runs on Android and iOS.
2. Navigation, Zustand, Reanimated, Gesture Handler and MMKV installed, configured and each proven by a small test.
3. A folder structure where the Game Engine physically cannot import UI code, enforced by tooling and not only by convention.
4. Tooling for tests, lint and type-checking from the first commit.

## 2. Layered Structure

```
src/
  engine/            PURE TypeScript. No react, react-native, mmkv, reanimated.
    core/            (empty in Phase 1) tile, board, tray, rules
    events/          (empty in Phase 1)
    commands/        (empty in Phase 1)
    levels/          (empty in Phase 1)
    ports/           interfaces the engine depends on: IRandom, IClock, ILevelSource
    index.ts         the ONLY public entry of the engine
  app/               composition root and wiring
    App.tsx
    providers/       app-level providers (gesture root, safe area, navigation)
    di/              creates concrete services and injects them
  ui/                React Native only
    screens/         Splash, Home, LevelMap, Game, Result, Settings (placeholders)
    components/      shared components (Phase 6)
    theme/           design tokens
  navigation/        navigator, route types
  state/             Zustand stores (UI and session state, not game rules)
  services/          concrete adapters behind interfaces
    storage/         IStorage + MmkvStorage + InMemoryStorage
    (later) audio, analytics, ads, purchases, cloud, leaderboard
  config/            constants, feature flags, environment
  types/             shared app types
__tests__/           mirrors src/
docs/
```

### Dependency rule (the core of Rule 2 and Rule 3)

```
ui  ->  state  ->  engine
ui  ->  services -> (interfaces from engine/ports or app types)
app ->  everything (composition root only)
engine -> nothing outside engine
```

- `engine` imports nothing from `ui`, `app`, `state`, `services`, or any React / RN package.
- `ui` reaches the engine only through `engine/index.ts` and never touches engine internals.
- Enforcement, not honor system:
  - ESLint `no-restricted-imports` / `import/no-restricted-paths` blocks the above edges.
  - The engine has its own `tsconfig.engine.json` with `"types": []` and `lib` set to plain ES, so DOM and RN globals do not compile there.
  - A Jest test walks `src/engine` and fails if any import resolves outside it or to a forbidden package.

## 3. Technology Choices

| Concern | Choice | Reason |
|---|---|---|
| Language | TypeScript, `strict: true`, `noUncheckedIndexedAccess` | Safety for a large engine |
| RN setup | React Native CLI (not Expo managed) | Native modules like MMKV and ad / IAP SDKs later; full native control for Phase 13 |
| Navigation | React Navigation, native stack | Standard, typed routes, works with the game flow |
| State | Zustand | Small, no boilerplate; stores hold UI and session state only |
| Animation | react-native-reanimated | UI-thread animation for Phase 7 |
| Gestures | react-native-gesture-handler | Required by Reanimated patterns and navigation |
| Storage | react-native-mmkv behind `IStorage` | Fast, sync; interface allows cloud-save sync and test doubles |
| Tests | Jest + React Native Testing Library | Engine tests run in plain Node, fast |
| Quality | ESLint, Prettier, `tsc --noEmit` | Run in CI later |

Exact versions are pinned at install time to a mutually compatible set (React Native, Reanimated, Gesture Handler and MMKV have version couplings). I will confirm compatibility from current docs at that point rather than assume it.

## 4. Key Design Decisions

**4.1 Storage abstraction (SOLID: Dependency Inversion).**
`IStorage { getString, setString, getNumber, setNumber, delete, keys }`. `MmkvStorage` implements it for the app; `InMemoryStorage` implements it for tests. Phase 9 progress code depends only on `IStorage`, so cloud save in Phase 11 is an added layer and not a rewrite. A `KEYS` module is the single owner of key names, and stored data carries a `schemaVersion`.

**4.2 Engine boundary.**
`engine/index.ts` is the public surface. Phase 2 exposes a `GameEngine` facade that takes commands and returns events plus an immutable state snapshot. The UI never mutates engine state. In Phase 1 the folder contains only ports and empty modules, plus the purity test, so the rule is enforced before there is code to break it.

**4.3 Zustand stores hold no game rules.**
A `gameSessionStore` will hold the latest engine snapshot for rendering. Rules stay in the engine, so the store is a thin cache and subscription point.

**4.4 Composition root.**
`app/di` is the only place that constructs `MmkvStorage`, seeds `IRandom`, and later creates ad and purchase services. Everything else receives dependencies by injection. This keeps every service replaceable and every module testable.

**4.5 Navigation types.**
A single `RootStackParamList` with typed routes for the six screens. Screens are placeholders in Phase 1 (title only), so navigation can be tested end to end.

**4.6 Scale.**
Nothing in Phase 1 stores or enumerates levels. Level access is by id through `ILevelSource` (declared in `engine/ports`, implemented in Phase 4), which is what keeps 10000 levels cheap.

## 5. Files Phase 1 Will Create

Config: `package.json`, `tsconfig.json`, `tsconfig.engine.json`, `babel.config.js` (Reanimated plugin), `metro.config.js`, `jest.config.js`, `.eslintrc.js`, `.prettierrc`, `.gitignore`, path aliases (`@engine`, `@ui`, `@state`, `@services`).

Source: `src/app/App.tsx`, `src/app/providers/*`, `src/app/di/container.ts`, `src/navigation/RootNavigator.tsx` and `types.ts`, six placeholder screens, `src/state/appStore.ts`, `src/services/storage/{IStorage,MmkvStorage,InMemoryStorage,keys}.ts`, `src/engine/ports/{IRandom,IClock,ILevelSource}.ts`, `src/engine/index.ts`, `src/config/*`.

## 6. Tests (Rule 4)

| Test | Proves |
|---|---|
| `engine.purity.test.ts` | No file in `src/engine` imports outside the engine or a forbidden package |
| `InMemoryStorage.test.ts` and a shared `IStorage` contract test | Contract holds; `MmkvStorage` runs the same contract with MMKV mocked |
| `appStore.test.ts` | Zustand store updates and selectors work |
| `RootNavigator.test.tsx` | All six routes render and navigate |
| Smoke test | App renders; Reanimated and Gesture Handler mock setup loads |

Native builds on Android and iOS are verified by running the app, which needs a device or emulator. Jest cannot prove that.

## 7. Prerequisites and Risks

- **Toolchain on this machine is unverified.** Needs Node LTS, JDK, Android Studio SDK and emulator. iOS builds need macOS and Xcode, so on this Windows machine iOS can be configured but not built or run here. I will check installed tools before starting and report gaps.
- **Version coupling** between RN, Reanimated, Gesture Handler and MMKV. Mitigation: pin a known-compatible set and verify with a build.
- **Cost of the strict engine boundary** is a little indirection. That is intended.

## 8. Definition of Done for Phase 1

1. App builds and launches on Android and shows Splash then Home with working navigation.
2. `tsc`, ESLint and Jest all pass.
3. The purity test and lint rules fail when engine code imports UI or React Native (verified by a deliberate violation, then reverted).
4. Files, architecture, code changes and test approach are explained, and the phase is submitted for approval.

## 9. Decisions Needed Before Coding

1. **React Native CLI vs Expo (dev build).** Recommendation: CLI, as above. Expo dev builds are viable and simplify setup, but add a layer for native ad / IAP SDKs.
2. **Package manager:** npm, yarn, or pnpm? Recommendation: npm, unless you already use another.
3. **Project location:** `C:\Users\Heena.T\TileMatchGame` (already used for docs).
4. **iOS:** confirm iOS is configured but unverified on this Windows machine.
