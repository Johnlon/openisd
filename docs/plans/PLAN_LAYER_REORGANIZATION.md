# Layer reorganisation — review & iteration plan

**Status:** DRAFT — planning in progress. Decisions in on Q2/Q4/Q5 (§6); Q3 pending John's read of the explanation (§7); Q1 scope still open (§6).
**Branch:** `refactor`
**Scope:** the design→backend rename, and "pulling stuff into the design folder" to finish the layer split.

> **LOW-LEVEL EXECUTION STRATEGY:** see [`PLAN_LAYER_REORGANIZATION_LOWLEVEL.md`](PLAN_LAYER_REORGANIZATION_LOWLEVEL.md)
> — the file-by-file plan (S1–S6), the IDE-MCP refactor mandate (§0), the per-file pure-helper
> classification (§5.2), and the risk register (§9).

---

## 1. Current layer map (as built)

Dependency chain: **`design` (leaf, no deps) → `persistence` → `ui`**.

| Layer | Lives in | Browser-tainted? | Notes |
|---|---|---|---|
| Physics engine | `design/engine` | **No** — pure | Engine, sweep, solver, air, filters, circuit |
| Domain model | `design/domain` | **No** — pure | `OpenISDProject`/`OpenISDDriver`, cells/lenses, zod schema, `RecordStore<R>` **port**, `projectRepo()` factory |
| WinISD codecs | `design/winisd`, `design/ini`, `design/filter` | **No** — pure | `.wdr`/`.wpr`/`.owpr` codecs, ini parser, driver-type chips |
| Store impls (proto) | `design/browser` | **Yes** | `indexedDbStore` (**stub — every method throws**), `memoryStore` (pure) |
| Prototype app | `design/app` | — | `composition.ts` (`assemble()`) + `workspace.ts` — unreachable from outside the package |
| Repos | `persistence/repos` | Mixed | bundled / my-driver / PR / prefs / viewState / project |
| Storage ports + impls | `persistence/storage` | Mixed | `KeyValueStorage` (localStorage + memory), `FileStorage`/`FileSave` (File System Access + anchor download) |
| Composition root | `ui/src/main.ts` | Yes | builds every service, provides `AppLogic` facade |
| Hooks | `ui/hooks` | Vue-bound | per-component injection keys + facades over `logic/` |
| UI logic | `ui/logic` | Mostly | `appState`, `useApplicationIO`, `driverSelection`, … but also **pure helpers** (`environment.ebpOf`, `series.ts`) |
| Components/shells | `ui/ui` | Yes | Vue |
| UI tests re: persistence | `ui/test/persistence` | — | browser specs about **persistence features** — not unit tests of `@openisd/persistence` |

## 2. Confirmed problems

| # | Observation | Evidence |
|---|---|---|
| P1 | `design/browser` contains a store — wrong | `indexedDbStore.ts:57-70` is a stub (throws "not implemented"); only pure `memoryStore` works. Store impl parked in the wrong package half. |
| P2 | `persistence` vs `ui/test/persistence` look unrelated | Two different things sharing a name. `ui/test/persistence/` is a **feature grouping** (persistence features tested through the UI), not a test of `@openisd/persistence`. |
| P3 | repo stuff and store stuff split across dirs | **Two parallel storage systems**: `design/domain/openisdRepo.ts` (port `RecordStore<R>`) + `design/browser/*` impls, AND `persistence/storage/*` (ports `KeyValueStorage` + `FileStorage` + impls). Also **two `ProjectRepo`s** with different persistence shapes: design's stores `OpenISDProjectSessionJson` (prototype), persistence's stores `.owpr` **text** (real app). |
| P4 | `main.ts` in ui **and** `design/app/composition` + `workspace` | Two composition roots. `design/app/` is a prototype ("stands in for the real UI", `workspace.ts:3`), dead from outside. `main.ts:19-25` is the real one. |
| P5 | prototype code shipped in the package | `design/app/` unreachable from outside (ASSESSMENT.md A4). `workspace.ts` duplicates `appState.ts`'s open/focus/close job. |

## 3. The browser-taint split — review of the idea

**Verdict: right instinct, and it is the *testable* version of the doctrine `domain/` already follows** (it hand-declares `crypto.randomUUID` to keep DOM libs out). A taint rule is mechanically checkable with AST tests — the same enforcement style `architecture.test.ts` already uses.

**Refinement — it's 3 tiers, not 2:**

| Tier | Examples | Runs where |
|---|---|---|
| No platform dep | engine, domain, codecs, repo logic over injected ports | browser AND node AND tests |
| Platform-portable I/O | `fetch`, `Blob`, `CompressionStream`, `TextEncoder`, `crypto` | both — trivial to move |
| Browser-tainted | `localStorage`, `indexedDB`, `showSaveFilePicker`, anchor download, `navigator.clipboard`, `location`, user gestures | browser only |

**On IoC:** injecting ports is exactly what the code already does (`RecordStoreFactory`, `KeyValueStorage`, `FileStorage` all injected), and it works **when the seam is narrow**. It does NOT abstract the **gesture** half of `showSaveFilePicker` (user gesture + window) — the port can be abstract, but the impl must stay in the browser half, and async/gesture semantics must be part of the port.

**File-system interactors:** two flavours, split accordingly — format codecs (`.wdr`/`.owpr`/`.wpr` bytes ⇄ domain) are **pure** (backend); the save/open dialogs and gestures are **browser** (impls of injected `FileStorage`).

## 4. Target structure

```
packages/backend            (was design — pull persistence in here)
  ├─ engine/                pure: physics
  ├─ domain/                pure: OpenISDProject/Driver, cells, schema
  ├─ winisd/  ini/  filter/ pure: codecs, ini, chips
  ├─ io/                    NEW pure: file-format codecs consolidated (.owpr/.wdr/.wpr)
  ├─ repos/                 pure: repo logic over injected ports (from persistence) + port interfaces
  ├─ storage/               pure: store PORTS (RecordStore, KeyValueStorage, FileStorage) + memory impls
  └─ browser/               tainted: indexedDB store, localStorage kv, FileSystemAccess save, share-link encode, catalogue fetch
packages/ui
  ├─ hooks/                 hook interfaces + thin facades
  ├─ logic/                 concrete hook impls (Vue/browser-bound workflows); pure helpers migrate to backend
  ├─ ui/                    components / shells
  └─ main.ts                THE composition root (delete design/app/ + workspace)
```

- `design/app/` (composition.ts + workspace.ts) → **delete**; one composition root stays in `ui/main.ts`.
- `packages/persistence` → **dissolves into `backend`** (pure parts to `backend/repos` + `backend/storage`, tainted impls to `backend/browser`).
- `ui/test/persistence` → rename to the *feature* (e.g. `driver-library` / `projects-tab`) to kill the P2 name collision.
- `workspace.ts`'s "focus by uuid" idea is **not dead** — `appState.ts` still focuses by index (QO92). Separate decision (D3).

## 5. Candidate change list (to confirm)

| # | Change | Kind |
|---|---|---|
| C1 | Rename `packages/design` → `packages/backend`; `@openisd/design` → `@openisd/backend` across 118 non-md files, configs, scripts, lockfile | mechanical |
| C2 | Delete `design/app/` (composition.ts, workspace.ts) — one composition root in `ui/main.ts` | delete |
| C3 | Pull `packages/persistence` pure parts into `backend/repos` + `backend/storage`; tainted impls into `backend/browser`; dissolve the package | move |
| C4 | Consolidate the two storage systems (RecordStore port vs KeyValueStorage port) and the two ProjectRepos | merge |
| C5 | New `backend/io` for file-format codecs; migrate pure helpers out of `ui/logic` (ebpOf, series) | move |
| C6 | Rename `ui/test/persistence` to the feature it tests | rename |
| C7 | Clarify "no backend" doctrine wording in README/ARCHITECTURE vs the `backend` package name | docs |
| C8 | (optional) Real app adopts focus-by-uuid Workspace pattern | bigger refactor |

## 6. Decisions received (2026-09-18)

| Q | Asked | Answer | Implication |
|---|---|---|---|
| Q1 | Full change list | **still planning** | Scope not locked. §5 stays a candidate list. |
| Q2 | `backend` vs "no backend" doctrine | **don't overthink — we know what we mean** | Keep the name. No doctrine rewording needed. C7 dropped. |
| Q3 | Workspace / focus-by-uuid | **needs explanation first** — see §7 | Pending John's yes/no. |
| Q4 | Composition location | **outside ui AND outside backend**; must not be ui-dependent if possible; ui calls it to do the assembly | New composition package (e.g. `packages/app`). UI imports it, calls `assemble()`, then mounts Vue. Invocation order settled in §7. |
| Q5 | Persistence fate | **if IoC-able → backend** | Persistence logic moves into `backend`; browser-tainted impls live in `backend/browser`. Full IoC analysis in §7. |

## 7. Q3 & Q5, explained

### 7.1 What "Workspace" and "focus by uuid" mean (Q3)

Two ways an app can remember "which open project is the active one":

- **Focus by index** (today's real app, `appState.ts`): open projects live in an array; focus is a position — `focusedIndex: Ref<number>` (`appState.ts:100`), moved by `focusProject(index)` / `removeProject(index)` (`:116`,`:127`). Every open/close/reorder **shifts indices**, so the focused position can silently point at a *different* project; the code papers over that with clamping (`removeProject` clamps to the new length, `:135`). It works, but the bookkeeping is fragile.
- **Focus by uuid** (the prototype `design/app/workspace.ts:28-47`): every project has a stable `uuid()`; focus stores that string — `#focused: string | null`. `focus(uuid)` / `close(uuid)` look up by identity, so closing project A never renames project B's focus. A uuid names the same project for as long as it exists.

That is the whole distinction. `Workspace` is just the prototype class that already does uuid-focus (`open`/`close`/`focus`/`create`), built to be UI-agnostic — the doc in `workspace.ts:23-26` argues the real app "needs and does not currently have" it (also QO92). Whether the real app adopts it is **C8** (optional, bigger refactor).

### 7.2 Is persistence fully IoC-able? (Q5)

Checked every file. **Yes — nearly everything moves to backend as pure logic; only 4 small things stay browser-bound.**

| File | Browser-taint | Move to |
|---|---|---|
| `repos/myDriverRepo.ts`, `myPassiveRadiatorRepo.ts`, `prefsRepo.ts`, `viewStateRepo.ts` | none (take injected `KeyValueStorage` + `Engine`) | `backend/repos` |
| `repos/bundledDriverRepo.ts`, `bundledPassiveRadiatorRepo.ts` | none (take injected `fetch`, `baseUrl`, `now`, `engine`) | `backend/repos` |
| `repos/projectSchemaUpgrade.ts`, `savedEntries.ts`, `storageKeys.ts` | none — pure | `backend/repos` |
| `repos/projectRepo.ts` | share link only: `CompressionStream`/`Blob`/`TextEncoder`/`btoa`/`atob` (tier-2, node+browser) **and `location.origin/pathname/hash`** (`:181`,`:185`) | logic → `backend/repos`; the `location` reads get an injected seam or move to `backend/browser` |
| `storage/keyValueStorage.ts` | interface pure; `createLocalStorage()` touches `localStorage` | interface → `backend/storage`; localStorage impl → `backend/browser` |
| `storage/fileStorage.ts`, `fileSave.ts` | interface pure; impl uses `showSaveFilePicker`, anchor, `URL.createObjectURL` | interface → `backend/storage`; impl → `backend/browser` |
| `design/browser/indexedDbStore.ts` (stub) | indexedDB | `backend/browser` |

**The honest limit of IoC:** it moves every *decision* out of browser code, but the *concrete impls* of `localStorage`, `indexedDB`, the file-save dialog and the `location` hash still need a browser. IoC can't turn those into pure code — it confines them to `backend/browser`, injected behind narrow ports. The user gesture behind `showSaveFilePicker` cannot be abstracted either; only the port around it.

### 7.3 Composition package + invocation order (Q4)

**Shape:** a new package (e.g. `packages/app`) that imports `@openisd/backend` and **no Vue**. It exports one function, `assemble(platform): AssembledApp`, that builds the engine, repos, stores and the app facade, taking the platform as an argument so it itself is browser-free:

```
platform = { storage, fileStorage, fetch, baseUrl, now, location, confirmReset }
ui/main.ts:  import { assemble } from '@openisd/app'
             const app = assemble(platform)          // UI calls the assembly
             createApp(App)  →  provideApp(app)      // UI maps it onto the Vue facade
             app.mount('#app')
```

So the **UI does not decide what exists** (no construction in `main.ts`), and the **composition does not know Vue** (no `createApp`, no `provideApp`, no components). `design/app/`'s prototype (`composition.ts` + `workspace.ts`) is superseded by this and deleted (C2).

## 8. Still open

1. **Q3** — adopt focus-by-uuid Workspace in the real app (C8), or stay on `appState`?
2. **Q1** — once John picks a scope, §5 becomes the locked work list.
3. Naming of the composition package (`packages/app` vs `packages/composition`).