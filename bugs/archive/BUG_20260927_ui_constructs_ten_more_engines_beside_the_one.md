# BUG_20260927_ui_constructs_ten_more_engines_beside_the_one

**Status:** FIXED 2026-10-05 — one engine in `logic/appState.ts`, one in `logic/sweepWorker.ts` (its own thread). `packages/design/test/architecture-engine-boundary.test.ts` ("the engine is constructed in a composition root, nowhere else") fails on any other `createEngine(` in the repo.

## Symptom

There is one Engine, `appState.ts`'s singleton, and ten more the UI builds for itself. The
singleton is constructed with the app's settings; the ten are constructed with none, so they
answer from the built-in defaults and cannot see a setting the user changed.

## Evidence

`packages/design/engine/Engine.ts:92` — `constructor(settings: AppSettings = defaultAppSettings)`.
A bare `new Engine()` silently takes the defaults.

`packages/ui/src/logic/appState.ts:150` builds the intended one through `getOrInit(slots,
'engine', …)`, passing live callbacks: `ventedLimits: () => appSettings.value.ventedLimits()`
and `envDefaults: () => appSettings.value.envDefaults()`.

Every other construction under `packages/ui/src`, all bare, counted 2026-09-27:

| File | Sites | What they ask it |
|---|---|---|
| `logic/environment.ts` | 4 | `solveEnvironment(env)`, `ebp()`, and `c` / `rho` at reference conditions |
| `logic/series.ts` | 3 | `passbandRef()`, `rolloffFreq()`, and `solveEnvironment({}).values.c` for the mach limit |
| `logic/appState.ts` | 2 | one more beside the singleton, plus `curveIssues`' own at :527 |
| `logic/useDriverCells.ts` | 1 | `issueFields()` |

`Engine.ts:347`, `:354`, `:359` and `:364` are the methods that read `#settings` —
`ventedPlausibility`, `ventedVolumePlausibility`, `ventedTuningPlausibility` and `envDefaults()`.
⚠ Not yet traced: whether any of the ten reaches one of those four today. The defect is that
nothing stops it — `new Engine()` compiles anywhere and looks correct.

## Cause

The Engine's settings parameter defaults, so constructing one without settings is silent. There
is no composition root the UI has to go through: `appState.ts`'s singleton is a module-level
`getOrInit` slot, not something a caller is handed, so a file that needs an engine method builds
its own rather than reaching the one that exists.

## Fix

One Engine, injected. The ten call sites take the singleton instead of constructing; whatever
they ask for that is genuinely settings-free (`ebp`, `rolloffFreq`, `issueFields`) is a pure
formula and can move to the domain or take the engine as an argument. An architecture test that
fails on `new Engine(` anywhere under `packages/ui/src` pins it afterwards — banning the
construction, not the import, leaves the legal text mappers (`dqIssueText`, `plausibilityToText`)
alone.

Owner: not this session. `packages/ui/src/logic/` is where the mobile-skin session has just
moved shared field-wiring logic; this needs to be sequenced with that, not raced against it.

## Verification

`grep -rn "new Engine(" packages/ui/src` returns one hit, the singleton. The architecture test
fails when a second is added back.
