# Decommission `packages/model`

**Ruling (John, 2026-09-05): "packages model needs to die."** This supersedes
`PLAN_DELETE_PACKAGES_MODEL.md` (2026-08-31) — that plan's numbers are stale; every table below
is re-verified against the current tree.

## 1. `packages/model` itself is junk, not broken

Every file under `packages/model/src/` (9 files, 5391 lines) and `packages/model/test/` (14
files) is 100% commented out. `index.ts` exports nothing. There is no live logic to migrate out
of this package — whatever it once did is gone; only its CONSUMERS still hold live imports
naming symbols that no longer exist.

**Action: delete `packages/model/` entirely**, after every consumer below is moved off it.

## 2. Files with an already-dead import — no work needed

These 8 files grep-match `@openisd/model` but the import itself is already commented out or is
prose-only. Confirm on sight, delete the dead line, no migration required:

| File                                                                                                          | Note                                                                                  |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/model/src/openisdRecord.ts`, `openisdDriver.ts`                                                     | prose mention only                                                                    |
| `packages/model/test/openisdDriver.test.ts`, `openisdRecord.test.ts`, `openisdYamlToWdrOnlyProdCalls.test.ts` | import already commented                                                              |
| `packages/persistence/src/repos/bundledPassiveRadiatorRepo.ts`, `projectRepo.ts`, `myDriverRepo.ts`           | import already commented                                                              |
| `packages/persistence/test/projectRepo-boxtype.test.ts`                                                       | import already commented                                                              |
| `../../packages/design/domain/COMMENTED_openisdYamlToWdr.ts`                                                                  | file is 100% dead, superseded by `packages/design/winisd/driverYmlToOpenisdAndWdr.ts` |

All of these die with `packages/model/` itself — no separate migration step.

## 3. Symbols `packages/design` already provides — justified, not assumed

| Symbol                                                           | Where in design                                                                                       | Why this counts as a real equivalent                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Provenance`, `Cell`, `FieldHandle`, `RawField`                  | `domain/index.ts`                                                                                     | Exported today, same shape the migration codemod (old plan §5) already targets                                                 |
| `OpenISDDriver` (type)                                           | `domain/index.ts`                                                                                     | Exported type-only, by design — construction goes through the seam, not a constructor                                          |
| `OpenISDProject` (type)                                          | `domain/index.ts`                                                                                     | Same pattern                                                                                                                   |
| `conformingRecordToOpenIsdDriver` / `conformingRecordToOpenIsdPassiveRadiatorStandalone` | `domain/index.ts`                                                                                     | Replaces all four of model's `fromX()` statics — ruled 2026-08-31, still the current seam                                      |
| `DriverType`, `Chip`                                             | `@openisd/design/filter`                                                                              | **Built after the old plan was written** — that plan said no design-side equivalent existed; it does now, in a sibling package |
| `checkConsistency()`                                             | `OpenISDDriver`                                                                                       | Replaces `consistencyIssues()` — a rename at call sites, not new work                                                          |
| `driverRecordProblems`                                           | Not a named export, but `conformingRecordToOpenIsdDriver`'s own `string[]` return already IS "every problem" | Functionally covered under a different shape — no gap to fill                                                                  |
| `OpenISDProjectMeta`                                             | `OpenISDProject.name` / `.comment`, both `RawField<string>`                                           | Meta is Field-shaped on the design side; no separate meta type needed                                                          |

## 4. Deliberately NOT exported — not gaps, do not fill them

| Symbol                                        | Why it stays hidden                                                                                                                                                                                                                       |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SpecField`                                   | `domain/index.ts`'s own header: a consumer wanting this is doing something the design says it should not                                                                                                                                  |
| `OpenISDDriverJson` (model's raw record type) | Same class as `SpecField` — `OpenISDDeviceJson` exists in `openisdRecordSchema.ts` but is barred from `domain/index.ts` by this repo's own standing order (`packages/design/AGENTS.md`, "INTERNAL JSON RECORD TYPES — NEVER RE-EXPORTED") |
| `ManagedProject`                              | Confirmed dead by design: `OpenISDProject` itself now owns saved/edited-layer state (`#saved`, `#edited`, `#current()`) — a consumer asking for `ManagedProject` is asking for something `OpenISDProject` already does                    |

## 5. `UiParams` — not a gap

`UiParams` flattened vent/box provenance for `ManagedProject`'s own bookkeeping. `OpenISDProject`
already holds that state live: `OpenISDBox`'s vented chamber publishes `volume_m3` and its
siblings as `FieldHandle<number>`, with real `.get()`/`.set()`/`.clear()`. `useVentGroup.ts`'s
own docstring already says the physics and provenance live on `OpenISDProject`
(`cell()`/`enter()`/`clear()`/`solveVentGroup()`) — it only calls through `ManagedProject`
because that's the wrapper it has today.

No new design capability needed. `enterBoxVolume_m3(value)` becomes `project.box.volume_m3.set(value)`,
the same mechanical substitution as everything else in §7.

## 6. Driver display name and classification chips — display/search logic, not domain logic

Found removing `myDriverName()` (`driverRepo.ts`, called `d.displayName()`, which does not exist
on the current `OpenISDDriver`). Ruled (John, 2026-09-05): **display name and chip
classification are not domain facts** — `OpenISDDriver` states T/S parameters and a stated
`driver_type`; turning those into a display string or a chip set is display/search logic and
does not belong on the driver.

**Done (2026-09-05).** `packages/ui/src/logic/driverDisplay.ts`:

- `displayNameOf(driver)` — brand + model, space-joined, `'Driver'` fallback when both are
  empty. Reads `driver.brand`/`driver.model` directly.
- `chipsOf(driver)` — the classification logic that lived in `driverRepo.ts`'s `classifyTypes()`
  (deleted from there), now reading `driver.spec[section].Fs_hz`/`Sd_m2`,
  `displayNameOf(driver)` and `driver.recordToPersist().driver_type.value` instead of taking
  four loose parameters.

`driver-type-chips.test.ts` rewritten onto `chipsOf(driver)`. The list-across-many-drivers case
(the browser/search list) reads `chipsOf`/`displayNameOf` per row on the same domain object
`bundledEntry()` already constructs — no separate flattened data structure needed; sequentially
wrapping each bundle record in the same domain wrapper serves the list view.

## 7. The 23 files with a live import — disposition

| File                                                                       | Symbols                                                                      | Disposition                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/src/types.ts`                                                 | `UiParams`, `OpenISDProjectMeta`                                             | Mechanical per §5; also separately imports dead `EngineDriver` from `@openisd/design/engine` — a second, unrelated dead import in the same file                                                                                                                                                         |
| `packages/ui/src/ui/components/DriverEditorModal.vue`                      | `OpenISDDriver`, `SpecField`, `Cell`, `Provenance`                           | Mechanical: `Cell`/`Provenance` → design's own; `SpecField`/`OpenISDDriver` usage needs checking against the codemod table (old plan §5) field by field                                                                                                                                                 |
| `packages/ui/src/ui/shells/original/OgTune.vue`                            | `Cell`, `SpecField`                                                          | Mechanical                                                                                                                                                                                                                                                                                              |
| `packages/ui/src/logic/managedProject.ts`                                  | `OpenISDDriver`, `OpenISDProject`, `Provenance`, `driverRecordProblems`      | **Whole file is dead weight** — old plan §4c already ruled this: delete, do not port; five consumers move to `OpenISDProject` directly                                                                                                                                                                  |
| `packages/ui/src/logic/driverBrowsingState.ts`                             | `OpenISDDriver` (type only)                                                  | Mechanical — type import only                                                                                                                                                                                                                                                                           |
| `packages/ui/src/logic/fields/fieldRegistry.ts`                            | `Provenance` (aliased)                                                       | Mechanical                                                                                                                                                                                                                                                                                              |
| `packages/ui/src/logic/useVentGroup.ts`                                    | `Provenance`                                                                 | Mechanical, but a consumer of `managedProject.ts` — sequence after §4c work                                                                                                                                                                                                                             |
| `packages/ui/src/logic/useDriverCells.ts`                                  | `Provenance`, `Cell`, `SpecField`                                            | Mechanical — this is the file blocking the DQ-accessor work                                                                                                                                                                                                                                             |
| `packages/ui/src/logic/appState.ts`                                        | `SpecField`, `OpenISDProject`, `Cell`, `UiParams`                            | Mechanical, including the `UiParams` part (§5)                                                                                                                                                                                                                                                          |
| `packages/ui/src/logic/usePrGroup.ts`                                      | `Provenance`                                                                 | Mechanical                                                                                                                                                                                                                                                                                              |
| `packages/ui/src/logic/driverSelection.ts`                                 | `OpenISDDriver`                                                              | Mechanical                                                                                                                                                                                                                                                                                              |
| `packages/persistence/src/repos/driverRepo.ts`                             | `OpenISDDriver`, `Engine`                                                    | **Done (2026-09-05).** `bundledEntry()` constructs (`conformingRecordToOpenIsdDriver`) and returns the driver; no field access. `FileEntry`'s summary columns (`Fs`, `Sd`, `Re`, `Znom`, `Pe`, `types`, `canonical`, display name) are dropped from this repo — they move wherever §6's design work lands them |
| 11 test files (`ui/test/ui/*`, `ui/test/logic/*`, `ui/test/persistence/*`) | mostly `OpenISDDriver`, `Provenance`, `Chip`, `DriverType`, `OpenISDProject` | Follow whichever production file they test moves first                                                                                                                                                                                                                                                  |

## 8. Order of work

1. `driverRepo.ts` — done: `bundledEntry()` constructs a driver (`conformingRecordToOpenIsdDriver`) and
   copies its record (`OpenISDDriver.recordToPersist()`), no field access. `myDriverName()`
   deleted (dead body, wrong layer).
2. §6 — driver display name and browser-list filtering, its own scoped design work.
3. Delete `managedProject.ts` per the existing §4c ruling — unblocks `useVentGroup.ts` and its
   other four consumers.
4. Mechanical files (everything else in §7, including `UiParams` per §5) — one at a time, TDD,
   verified against the codemod substitution table (old plan §5: `X()`→`.get().value`,
   `XCell()`→`.get()`, `enterX(v)`→`.set(v)`, `clearX()`→`.clear()`).
5. Delete `packages/model/` once every consumer has moved.

## 9. Verification, unchanged from the old plan

- `npx tsc --noEmit` clean for design, ui, winisd, persistence — with `packages/model` deleted.
- `npx vitest run packages/design` green.
- `npx playwright test` green.
- `bash scripts/health-check.sh` before any "done" claim.
- On port 4000: a driver-editor field still shows its Entered/Calculated state.

## 10. `appState.ts`'s `ManagedProject` calls, resolved one at a time against real callers

§7's row calls this file "mechanical." It is not a rename: every call site was traced to its
actual caller (never inferred from `managedProject.ts`'s own surface, which has no live callers
of most of its methods) and resolved individually.

| Old call, old object                                                                                                                                                      | Resolution                                                                                                                                             | Purpose                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groundByProject.set(p, projectFingerprint())` in `markProjectSaved()`, `WeakMap`                                                                                         | `p.save()` on `OpenISDProject`                                                                                                                         | commit edits as the new clean baseline after save                                                                                                                                                   |
| `currentGround() !== projectFingerprint()`, JSON strings                                                                                                                  | `p.isModified()` on `OpenISDProject`                                                                                                                   | drives the dirty indicator                                                                                                                                                                          |
| `resetProjectToGround()`'s `JSON.parse` + `loadUiParams`/`loadDriverFromPersistedText` replay                                                                             | `await p.cancel(confirm)` on `OpenISDProject`                                                                                                          | discard unsaved edits, restore last save                                                                                                                                                            |
| `p.loadEmpty()` in `appState.ts`'s `newProject()`                                                                                                                         | deleted — no replacement                                                                                                                               | there is no empty-driver project state; delete the whole dead body                                                                                                                                  |
| `live.value.brand()`/`.model()` (`driverName`, appState.ts) and `project.value.model()` (`OriginalShell.vue:514`)                                                         | `displayNameOf(p.driver)` from `logic/driverDisplay.ts` (§6)                                                                                           | tab labels and download filenames — reuses the already-agreed display-name function, `p.driver` is `OpenISDProject`'s existing getter                                                               |
| `live.value.errors()` (`driverErrors()`, appState.ts)                                                                                                                     | deleted, folded into `sweep()`/`maxCurves()` themselves — see `bugs/BUG_20260906_appstate_reimplements_sweep_instead_of_calling_project_sweep.md`      | the engine's own sweep/maxCurves postconditions (`classifyFinite`/`classifyFlatClamp`/`classifyMaxFinite`) become private to `engine/sweep.ts`; no caller validates sweep input/output from outside |
| `new Engine().validateParams(...)` (`paramIssues`, appState.ts) and `OpenISDProject.validateParams(P)`                                                                    | deleted — no replacement                                                                                                                               | redundant with the sweep/maxCurves postconditions above; a bad param combination already shows up as a non-finite or clamped sweep result                                                           |
| `live.value.persistedDriverText()` (`persistedDriver`, appState.ts)                                                                                                       | deleted — no replacement                                                                                                                               | only fed the ground-snapshot JSON `p.cancel(confirm)` already replaces; exposing the driver's persisted text was itself an encapsulation leak                                                       |
| `resetProjectToGround()`'s `loadDriverFromPersistedText(g.driver)`                                                                                                        | deleted, superseded by `p.cancel(confirm)` (already resolved above)                                                                                    | same ground/edited apparatus as the first three rows                                                                                                                                                |
| `ManagedProject.fromProject(source.projectToPersist())` + `groundByProject.set(...)` + `copy.mutate(p => p.setProjectMeta(...))` (`duplicateFocusedProject`, appState.ts) | new instance method `p.duplicate(newName): OpenISDProject`, built from `OpenISDProject.wrap(this.#current(), this.#engine)` + `copy.name.set(newName)` | "+ Copy" toolbar button — an independent project with a new UUID (via `wrap`'s own `newUuid()`), not a hand-assembled snapshot copy in the UI layer                                                 |

`groundByProject`, `projectFingerprint()`, `currentGround()` are a second, parallel
ground/edited tracker duplicating `OpenISDProject`'s own native `#saved`/`#edited`/
`isModified()`/`save()`/`cancel()`. Delete the duplicate apparatus in `appState.ts`; do not port
it.

"New Project" never mutates a focused project and never creates a driver-less placeholder. The
wizard (`OgNewProject.vue`) holds `name`/`box`/`volumeL`/`frontVolumeL` in local `ref`s across
its steps; only once a driver is chosen (bundle, My Drivers, or the current project's own
driver, edited) does the real build happen: `newProject(driver, engine)` from `@openisd/design`,
`.volume_m3(...)`/`.frontVolume_m3(...)`, `.build()`, then `repo.save()` and `addProject()` with
focus. `appState.ts` never holds or builds a project in progress.

| `openNewProject()` (`OriginalShell.vue`) + `openBlankProject()`/`ManagedProject.createEmpty()` (`appState.ts`), called from `onFile()` before `importFile(f)` | deleted, both functions, every call site | a project exists only three ways — built via the wizard, reopened from storage, or reopened from disk; there is no fourth "blank tab, fill in later" path |
| `onFile()`'s `.wpr`/`.owpr` branches inside `importFile` (`useApplicationIO.ts`), which mutate the already-open blank project in place | parse the file into a project record, `OpenISDProject.wrap(json, engine)`, then `addProject()` — one project, built once | opening a project file is the same "reopen from disk" path as reopening from storage, never a mutate-an-existing-tab step |
| `p.subscribe(...)` (`appState.ts`'s `resubscribe()`) | unchanged — `OpenISDProject.subscribe(fn)` already exists with the same signature | fires the Vue `live` bridge whenever the focused project mutates |

Remaining call sites: `p.load(project)`, `requireFocusedProject().projectToPersist()` — still
being traced to their real callers one at a time before any new `OpenISDProject` method is
built.

`loadDriverFromWdrText`/`loadDriverFromOwdrText` on `OpenISDProject` are unchanged and correct as
called from `driverSelection.ts` (choosing a driver embeds it into the focused project — the
project already exists) and from `importFile`'s `.wdr`/`.owdr` branches (loading a bare driver
file, no project construction involved).
