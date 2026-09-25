# Layer reorganisation — LOW-LEVEL EXECUTION STRATEGY

**Status:** EXECUTION-READY PLAN (John: "we are still planning" — this is the plan; scope lock still pending in §A.1)
**Branch:** `refactor`
**Read alongside:** `PLAN_LAYER_REORGANIZATION.md` §A (decisions + Q3/Q5 explanations).

---

## 0. Tooling rule — every move goes through the IDE's refactor, not hand edits

**Demand (John):** any rename or move must be done **through an IDE MCP** so the IDE performs the
refactor and updates references in one atomic operation. If no IDE MCP is wired, use the
**equivalent** automated path below — never one-file-at-a-time edits.

| # | Tool | Use for |
|---|---|---|
| T1 | **IDE MCP refactor** (TypeScript language-server / rename + move tools in the IDE) | the package rename, symbol renames, file moves — references rewritten atomically |
| T2 | **Fallback "equivalent"** (when no MCP is wired): `git mv` + **one** workspace-wide replace of the specifier prefix + `npx tsc -p <pkg> --noEmit` as the automated verifier | same, if T1 unavailable |
| T3 | `npm install` | re-links `node_modules/@openisd/*`, regenerates `package-lock.json` |

MCP status today: **none configured** (checked `.opencode/`, `~/.config/opencode/opencode.jsonc`,
`.playwright-mcp/` is browser automation, not refactoring). The repo has no MCP wiring for
refactoring, so plan for T1-if-available else T2. If John wires a TS-language-server MCP, T1 takes
over; the steps below are written to be MCP-shaped (whole refactor, then verify), so either path
fits.

**Every step's gate:** `tsc --noEmit` on every affected package + the affected vitest projects
green + stage by filename + a WIP commit per step. Never `git add -A`.

---

## 1. Execution order

| Step | Change | Blocks on | Gate after step |
|---|---|---|---|
| **S1** | C1 — rename package `design`→`backend` | — | tsc ×3 (backend/persistence/ui) + vitest (design+persistence+ui unit) + playwright smoke |
| **S2** | C2 — delete prototype `app/` + its persistence half (`domain/openisdRepo.ts`, `browser/*`, `test/persistence.test.ts`, `test/workspace.test.ts`) | S1 | tsc ×3 + vitest; re-home the 2 boundary test files (§3.5) |
| **S3** | C3 — pull `@openisd/persistence` into `backend/repos` + `backend/storage` + `backend/browser` | S1 | tsc ×3 + vitest (backend holds the moved persistence tests) |
| **S4** | C4 — pure-helper migration (`backend/io`, `backend/engine/plot`, `backend/units`) | S1 | tsc ×3 + vitest ui |
| **S5** | C5 — rename `ui/test/persistence` to feature names | S2 | vitest ui + playwright |
| **S6** | C6 — new composition package `@openisd/app`; `ui/main.ts` slims to "call assemble, mount Vue" | S2, S3 | tsc ×3 + vitest + playwright + `bash scripts/health-check.sh` |

Why S1 first: every other step references the package name. S2 before S3: killing the prototype
removes the *dead* persistence half, leaving only the *live* one to move.

---

## 2. S1 — C1 package rename `packages/design` → `packages/backend`

### 2.1 Import specifiers (the whole rename is this list)

| Old | New | Files touching it |
|---|---|---|
| `@openisd/design` | `@openisd/backend` | 64 ui + 11 persistence + 33 design-internal + scripts |
| `@openisd/design/engine` | `@openisd/backend/engine` | ~58 files |
| `@openisd/design/browser` | `@openisd/backend/browser` | design-internal tests + workspace/composition |
| `@openisd/design/winisd` | `@openisd/backend/winisd` | ui tests + design tests + ui src |
| `@openisd/design/filter` | `@openisd/backend/filter` | ui src (driverDisplay, driverBrowsingState) + tests |
| `@openisd/design/ini` | `@openisd/backend/ini` | design/test/ini |

A single prefix replace `@openisd/design` → `@openisd/backend` covers every subpath. The stale
`@openisd/design/domain` specifier appears only in `test/probes/store-path.repro.test.ts` + root
scratch `.txt` — junk (§2.4).

### 2.2 Config inventory (exact files + lines)

| File | What changes |
|---|---|
| `packages/design/package.json` | `name`, the 6 `exports` map entries (`.`, `/browser`, `/engine`, `/filter`, `/winisd`, `/ini`), `description` |
| `packages/persistence/package.json` | dep `@openisd/design` → `@openisd/backend` |
| `packages/ui/package.json` | dep `@openisd/design` → `@openisd/backend` |
| `package.json` | `typecheck:design` → `tsc -p packages/backend`; `build:bridge` → `packages/backend/vite.bridge.config.ts`; script name `typecheck:design` → `typecheck:backend` (update `typecheck.mjs` caller) |
| `vitest.config.ts` | project `name:'design'`, `root:'./packages/design'` → `backend` |
| `eslint.config.js` | globs at `:59`,`:124`,`:149`; comment refs at `:144`,`:180`,`:182`,`:186`; `no-restricted-imports` messages at `:191`,`:192`,`:196` (`@openisd/design/engine` → `@openisd/backend/engine`) |
| `scripts/typecheck.mjs` | `new Typecheck('design', … ['tsc','-p','packages/design'…])` |
| `scripts/bundleStamp.mjs` | `SOURCE_DIRS = ['packages/design/domain','packages/design/filter']` |
| `scripts/bundleProjection.mjs` | 2 imports of `../packages/design/domain/*.ts` |
| `scripts/bundle-drivers.mjs` | 1 import of `../packages/design/domain/openisdSchema.ts` |
| `scripts/roundTripGate.mjs` | 2 imports `@openisd/design` + `@openisd/design/engine`; 2 comment refs |
| `scripts/hooks-local/pre-commit` | `npx vitest run packages/design packages/persistence` |
| `scripts/test.sh` | comment/path refs |
| `.claude/rules/ui.md` (+ `.opencode/rules/links.md` if referenced) | any `packages/design` prose |
| `package-lock.json` | regenerated by `npm install` |
| Living docs | README, ARCHITECTURE, TESTING_STRATEGY, ASSESSMENT, HANDOVER1, `docs/design/*` that name the path; `bugs/domain_refactor_plan.md` header comments |
| `packages/design/AGENTS.md`, `packages/design/CLAUDE.md` | move with `git mv`; prose paths inside |

NOT touched: `questions.yml` (historical ledger), old `bugs/*.md`, past `LOG.md` entries,
`docs/plans/*` historical minutes.

### 2.3 Ordered steps (T1/T2 tooling)

1. Edit `packages/design/package.json`: name + exports + description.
2. Edit the two dependents' `package.json` deps.
3. `npm install` (relinks, rewrites lockfile). Verify `node_modules/@openisd/backend` exists.
4. **The rename**: T1 via IDE-MCP rename of the workspace module, or T2 — `git mv packages/design packages/backend`, then one workspace-wide replace `@openisd/design` → `@openisd/backend` across `packages/**`, `scripts/**`, config files (excluding `questions.yml`, `node_modules`, `dist`, `package-lock.json` — lockfile regenerates).
5. Fix config files per §2.2 (globs, script names, pre-commit).
6. `npx tsc -p packages/backend --noEmit && npx tsc -p packages/persistence --noEmit && npx tsc -p packages/ui --noEmit`.
7. `npx vitest run packages/backend packages/persistence` + `packages/ui` unit; one playwright spec (e.g. `app.browser`).
8. WIP commit (stage by filename).

### 2.4 Junk to delete (not tracked / scratch, references old name)

`test/probes/*` (10 `zz-*.spec.ts` + `store-path.repro.test.ts`), root `*.txt`
(`err.txt`, `tsc_output.txt`, `persist_errors.txt`, `test_useApp.txt`),
`scratch_opencode_transcript.txt`, `test-chip.ts`, `test-field.ts`, `test-parse.*`, `test-wdr.ts`,
`test-pw.spec.ts`. Only if John confirms — these are ASSESSMENT T4 probes + migration scratch.

---

## 3. S2 — C2 delete the prototype and its persistence half

**The decisive fact:** the design-side persistence surface — `RecordStore<R>`,
`RecordStoreFactory`, `projectRepo()`, `memoryStore`, `indexedDbStore`, `Workspace`,
`assemble()` — is consumed **only** by `design/app/*` and `design/test/{persistence,workspace}.test.ts`.
No UI or persistence source imports any of it. So it is dead as soon as the prototype dies: **delete,
do not move.**

### 3.1 Deletions

| Delete | Notes |
|---|---|
| `packages/backend/app/composition.ts`, `workspace.ts` | the prototype |
| `packages/backend/domain/openisdRepo.ts` | `RecordStore`/`RecordStoreFactory`/`projectRepo`/`ProjectListing`/`DeleteChallenge`/`DeleteOutcome` |
| `packages/backend/browser/` (index.ts, indexedDbStore.ts) | the browser store stub + barrel |
| `packages/backend/test/persistence.test.ts`, `workspace.test.ts` | the prototype's boundary tests — **re-homed in §3.5, not lost** |
| `@openisd/backend/browser` export entry in `backend/package.json` | gone |
| `@openisd/backend` imports of `/browser` (in the 2 test files) | gone with the tests |

### 3.2 Barrel surgery in `domain/index.ts`

- Remove the `projectRepo` value export and the `ProjectRepo`/`ProjectListing`/`RecordStore`/
  `RecordStoreFactory`/`DeleteChallenge`/`DeleteOutcome` type exports (lines ~90-107).
- Remove the large "PERSISTENCE / parametricity" comment blocks (lines ~80-106).
- `packages/persistence/src/index.ts:50-51` re-exports `ProjectListing/DeleteChallenge/DeleteOutcome`
  from `@openisd/design` — those three types must **move into persistence's `projectRepo.ts`**
  (they are repo-contract types, they belong with the repo), and the `export type {…} from '@openisd/design'`
  line is deleted.

### 3.3 Type relocation (`ProjectListing` family)

`ProjectListing`, `DeleteChallenge`, `DeleteOutcome` already have live consumers in persistence
(`projectRepo.ts` `remove(id, confirm: DeleteChallenge)`; the `list()` returns `StoredProjectListing`).
Merge: define them in `packages/persistence/src/repos/projectRepo.ts` and re-export from
`packages/persistence/src/index.ts`. The design `projectRepo` that used them is deleted.

### 3.4 Architecture gates

`packages/backend/test/architecture-no-casts.test.ts` scans the package's files — verify it does
not assert on the deleted `app/`/`openisdRepo.ts`. Also audit the other 7 `architecture-*.test.ts`
for paths that die (several prior bugs: "architecture gates name deleted packages").

### 3.5 Test re-homing (a-skip-is-a-fail — coverage is NOT dropped)

The 2 deleted test files asserted real behaviour (repo boundary over an injected store; project
open/focus/close). Their replacement, written in **S6**, lives in the new `packages/app` test dir,
rewritten against the surviving `KeyValueStorage`/`createProjectRepo` seam:
- persistence-boundary coverage → `packages/app/test/persistence-boundary.test.ts`
- project-session coverage → `packages/app/test/project-session.test.ts`

Until S6 lands, this is a **known coverage dip** — record it in the S6 step, never silently drop it.

---

## 4. S3 — C3 pull `@openisd/persistence` into `backend`

### 4.1 File-by-file move table

| Source (`packages/persistence/src/`) | Destination (`packages/backend/`) | Taint | IoC change |
|---|---|---|---|
| `repos/bundledIndex.ts` | `repos/bundledIndex.ts` | none | — |
| `repos/bundledDriverRepo.ts` | `repos/bundledDriverRepo.ts` | none | already takes `{fetch, baseUrl, engine, now, maxAge_ms}` |
| `repos/bundledPassiveRadiatorRepo.ts` | `repos/bundledPassiveRadiatorRepo.ts` | none | same |
| `repos/bundledRepo.ts` | `repos/bundledRepo.ts` | none | — |
| `repos/myDriverRepo.ts` | `repos/myDriverRepo.ts` | none | takes injected `KeyValueStorage` + `Engine` |
| `repos/myPassiveRadiatorRepo.ts` | `repos/myPassiveRadiatorRepo.ts` | none | same |
| `repos/prefsRepo.ts` | `repos/prefsRepo.ts` | none | takes injected `KeyValueStorage` |
| `repos/viewStateRepo.ts` | `repos/viewStateRepo.ts` | none | same |
| `repos/savedEntries.ts` | `repos/savedEntries.ts` | none | — |
| `repos/storageKeys.ts` | `repos/storageKeys.ts` | none | — |
| `repos/projectSchemaUpgrade.ts` | `repos/projectSchemaUpgrade.ts` | none | — |
| `repos/projectRepo.ts` | `repos/projectRepo.ts` | **`location`** only | inject a `readLocation(): {origin,pathname,hash}` port (or move `stateToUrl`/`loadFromHash` into `browser/`) |
| `storage/keyValueStorage.ts` | **SPLIT** → `storage/keyValueStorage.ts` (interface + `createMemoryStorage`) **and** `browser/localStorage.ts` (`createLocalStorage`) | mixed | split at the `localStorage` touch point (`:24-26`) |
| `storage/fileSave.ts` | **SPLIT** → `storage/fileSave.ts` (`FileSave` interface) **and** `browser/fileSave.ts` (`showSaveFilePicker` + anchor, `:18-85`) | mixed | split at the FSA/anchor impls |
| `storage/fileStorage.ts` | **SPLIT** → `storage/fileStorage.ts` (`FileStorage` interface + `createFileStorage` selecting by capability) **and** `browser/fileStorage.ts` (FSA impl) | mixed | split |
| `index.ts` (barrel) | dissolve → its exports re-exported from `backend`'s new `repos`/`storage` barrels | — | — |

### 4.2 Config + dependency changes

- `vitest.config.ts`: **delete** the `persistence` project; its tests move into `backend`'s project
  (root `packages/backend`, `include: ['test/**/*.test.{mjs,ts}']` already covers a `test/persistence/` dir).
- `packages/ui/package.json`: drop `@openisd/persistence` dep; the 10 ui src files + tests that
  import `@openisd/persistence` switch specifier to `@openisd/backend` (T1/T2).
- `scripts/hooks-local/pre-commit`: `npx vitest run packages/backend` (drops the persistence path).
- `packages/backend/package.json`: add `yaml`+`zod` already present; persistence adds nothing new
  (verify: `@openisd/persistence`'s package.json deps — confirm none beyond design).

### 4.3 Test moves

`packages/persistence/test/{savedLibrary,bundledDriverRepo,projectRepo-boxtype}.test.ts` →
`packages/backend/test/persistence/`. They already import `@openisd/design` — the S1 prefix replace
handles it. `projectRepo-boxtype.test.ts` imports `@openisd/design` only — moves clean.

---

## 5. S4 — C4 pure-helper migration

### 5.1 What becomes `backend/io` (file-format codecs, pure)

Extracted from `ui/logic/fileImportExport.ts` (which today re-implements codec calls against the
`appState` engine singleton — §5.3): `driverToWdrBytes`, `driverToOwdrBytes`,
`projectToWprBytes`, `wdrTextToDriver`, `owdrTextToDriver`, `wprTextToProject`,
`owprTextToProject`. Signature rule: **take `engine: Engine` as a parameter** — never import the
module-level singleton.

### 5.2 `ui/logic` + `ui/hooks` per-file classification (the "pure helpers" made concrete)

| File | Verdict | Destination / reason |
|---|---|---|
| `logic/environment.ts` | **MOVE** | `backend/engine/environment.ts` — `ebpOf`, `driveVoltageFor`, `referenceC`, `referenceRho`, `parseLossMode`, `airForEnvironment`, `DEFAULT_RE_OHM` (already imports `@openisd/design/engine`) |
| `logic/cursorFrequency.ts` | **MOVE** | `backend/engine/plot.ts` — `steppedFrequency`, `clampedFrequency`, `interpolatedY` |
| `logic/series.ts` | **SPLIT** | plot math (`seriesFor`, `rangeStatsOf`, `buildPlotData` core) → `backend/engine/plot.ts`; `TAB_META`/`TABS`/`parseChartTabId` + the `ChartTabId`/`Design`/`PlotParams` types → `ui/logic/chartTabs.ts` (they are UI chart-tab presentation) |
| `logic/fields/units.ts` | **SPLIT** | `UNIT_GROUPS`/`UnitGroup`/`UnitDef`/`unitDef`/`toDisplay`/`fromDisplay`/`nextToken` → `backend/units/units.ts`; `displayPrecision` stays ui (display rule) |
| `logic/fieldKeys.ts` | **MOVE** | `backend/domain/fieldKeys.ts` — `FIELD_KEY` spec-key vocabulary |
| `logic/sweepIssueMessage.ts` | **STAY** | issue→text wording is UI presentation |
| `logic/provenance.ts` | **STAY** | equation-inspector display map |
| `logic/hmrSingleton.ts` | **STAY** | Vue HMR helper |
| `logic/bundledIndexRows.ts` | **STAY** | builds UI search rows via `driverDisplay` |
| `logic/domEvents.ts` | **STAY** | browser event helpers (`HTMLElement`) |
| `logic/toneGenerator.ts` | **STAY** | WebAudio (`AudioContext`) |
| `logic/useDriverCells.ts`, `usePrGroup.ts`, `useVentGroup.ts` | **STAY** | the UI-logic layer (concrete hook impls) per John's model |
| `logic/driverSpecFields.ts` | **STAY** | app workflow |
| `logic/driverDisplay.ts` | **STAY** | ruled display/search logic (§6 of DECOMMISSION plan) |
| `logic/driverDraft.ts`, `driverSelection.ts`, `fileImportExport.ts`, `driverFileText.ts`, `urlAppState.ts` | **STAY** (fileImportExport loses its codec half to `backend/io`) | app workflow, appState-bound |
| `logic/fields/fieldRegistry.ts` | **STAY** | UI form-field spec registry |

### 5.3 The blocker: the `engine` module singleton (ASSESSMENT A1)

`appState.ts` exports `const engine = getOrInit(…)`; `driverDraft.ts` and `fileImportExport.ts`
import it. This blocks moving any codec logic into `backend`. Fix **first** (small, TDD):
extract `fileImportExport`'s codec functions to `backend/io` taking `engine` as an arg; the ui
files pass `requireFocusedProject().engine` or the composition-provided engine in. Deleting the
singleton import is optional later (A1); the `backend/io` functions must simply never construct one.

---

## 6. S5 — C5 rename `ui/test/persistence` to feature names

Kills the P2 name collision. Renames are mechanical (`git mv`), no assertion changes.

| Current | Target (feature) |
|---|---|
| `driver-browser-controls`, `driver-count`, `driver-favorites`, `driver-scope-chip`, `driver-search-interactive`, `driver-selection`, `driver-summary`, `test-bundle`, `bundle-drivers-disposition`, `bundle-stamp`, `bundled-index-artifacts`, `round-trip-gate` | `test/driver-library/*` |
| `my-drivers`, `my-drivers-failures`, `my-drivers-filtering` | `test/my-drivers/*` |
| `original-projects` | `test/projects-tab/*` |

Note: `ui/test/ui/` may carry more persistence-flavoured specs (`original-projects` already listed).
Regenerate the failing-test tracker (`build/failing-tests.json`) after the move — it keys by path.

---

## 7. S6 — C6 composition package `@openisd/app`

**Decision Q4:** composition lives **outside ui and outside backend**; it must not be
ui-dependent; the ui calls it to do the assembly.

| File | Purpose |
|---|---|
| `packages/app/package.json` | `@openisd/app`, deps: `@openisd/backend` only |
| `packages/app/src/assemble.ts` | `assemble(platform: Platform): AssembledApp` — builds `Engine`, all repos, `DesignIO`, returns the facade. **No Vue import anywhere.** |
| `packages/app/src/platform.ts` | `Platform = { storage: KeyValueStorage; fileStorage: FileStorage; fetch: typeof fetch; baseUrl: string; now: () => number; confirmReset: (q: string) => boolean; readLocation: () => {origin,pathname,hash} }` — browser-free |
| `packages/app/src/assemble.ts` exports `AssembledApp` | pure type: `{ engine, projectRepo, myDrivers, bundledDrivers, prefs, myPassiveRadiators, bundledPRs, viewState, designIO, selection, driverBrowsing, logging, faultLog }` |

`ui/src/main.ts` after S6 (invocation order settled):

```
import { createLocalStorage, createFileStorage } from '@openisd/backend/browser';
import { assemble } from '@openisd/app';
const platform = { storage: createLocalStorage(), fileStorage: createFileStorage(),
                   fetch, baseUrl: import.meta.env.BASE_URL, now: Date.now,
                   confirmReset: q => confirm(q), readLocation: () => location };
const app = assemble(platform);          // UI calls the assembly — no construction here
createApp(App).directive(...).directive(...);
provideApp(app, app);                    // map AssembledApp onto the Vue facade
app.mount('#app');
```

`ui/logic/app.ts` (provideApp/useApp/AppLogic) keeps the Vue `InjectionKey`; `AssembledApp` becomes
its source shape. `design/app/`'s `assemble` is already deleted (S2); this is its real replacement.

**Tests (absorb the S2 dip):** `packages/app/test/persistence-boundary.test.ts` +
`project-session.test.ts` — rewritten against `KeyValueStorage`-memory + fake clock, same assertions
as the deleted `design/test/persistence.test.ts` + `workspace.test.ts`.
`vitest.config.ts` gains an `app` project (`root: './packages/app'`).

---

## 8. Verification matrix

| Gate | Command | After |
|---|---|---|
| Typecheck | `npx tsc -p packages/backend --noEmit` (+ persistence while it exists, + ui; later app) | every step |
| Unit | `npx vitest run packages/backend` (then `packages/ui`, `packages/app`) | every step |
| Browser smoke | one spec e.g. `app.browser.spec.ts` | S1, S5, S6 |
| Full browser | `scripts/test-browser.sh` or the failing-runner | before "done" |
| Health | `bash scripts/health-check.sh` | S6 only |
| Coverage | vitest thresholds — re-baseline AFTER green (never lower to clear red) | S2, S3 |

---

## 9. Risk register

| # | Risk | Mitigation |
|---|---|---|
| R1 | **Two ProjectRepos / two persistence shapes** (design: `OpenISDProjectSessionJson`; persistence: `.owpr` text) | resolved by S2 — the session-json one dies with the prototype |
| R2 | **Module `engine` singleton** (A1) blocks S4 codec move | §5.3 — extract to `backend/io` with engine as arg first |
| R3 | **Coverage thresholds go red** when covered lines are deleted (S2: app, openisdRepo) | re-baseline after green; never lower the gate (D5/R2) |
| R4 | **Deleting tests violates a-skip-is-a-fail** | §3.5 — replacement tests land in S6, tracked as a known dip, never silent |
| R5 | **Dirty tree** — `refactor` is 19 ahead, uncommitted work from other sessions | commit-first per repo rule before touching; never revert others' work |
| R6 | **`@openisd/design/domain` stale specifier** + root scratch files | §2.4 delete with John's OK |
| R7 | **Architecture gates that name deleted paths** (prior bugs: gates pointing at `packages/model`) | §3.4 audit after S2 |
| R8 | **Name docs collision** ("no backend, no server" in README/ARCHITECTURE) | DECIDED — keep name, no wording change (Q2) |
| R9 | **`packages/app` composition** must stay browser-free | platform injected (§7); never import Vue/`location`/`localStorage` in `assemble.ts` |

---

## A. Decisions & explanations (reference)

- **Q1 scope** — "we are still planning": this doc is the plan; §1's S1–S6 become the work list on John's go.
- **Q2 name** — keep `backend`; no doctrine rewording (John: "don't overthink — we know what we mean").
- **Q3 workspace/focus-by-uuid** — explained in `PLAN_LAYER_REORGANIZATION.md` §7.1; pending yes/no (C8, not in S1–S6).
- **Q4 composition** — outside ui & backend; ui calls `assemble` (§7).
- **Q5 persistence** — IoC-able, moves to backend (§4; IoC limit: concrete `localStorage`/`indexedDB`/file-dialog/`location` impls stay in `backend/browser`).