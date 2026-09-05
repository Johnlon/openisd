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
| `packages/design/domain/openisdYamlToWdr.ts`                                                                  | file is 100% dead, superseded by `packages/design/winisd/driverYmlToOpenisdAndWdr.ts` |

All of these die with `packages/model/` itself — no separate migration step.

## 3. Symbols `packages/design` already provides — justified, not assumed

| Symbol                                                           | Where in design                                                                                       | Why this counts as a real equivalent                                                                                           |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `Provenance`, `Cell`, `FieldHandle`, `RawField`                  | `domain/index.ts`                                                                                     | Exported today, same shape the migration codemod (old plan §5) already targets                                                 |
| `OpenISDDriver` (type)                                           | `domain/index.ts`                                                                                     | Exported type-only, by design — construction goes through the seam, not a constructor                                          |
| `OpenISDProject` (type)                                          | `domain/index.ts`                                                                                     | Same pattern                                                                                                                   |
| `conformingRecordToDriver` / `conformingRecordToPassiveRadiator` | `domain/index.ts`                                                                                     | Replaces all four of model's `fromX()` statics — ruled 2026-08-31, still the current seam                                      |
| `DriverType`, `Chip`                                             | `@openisd/design/filter`                                                                              | **Built after the old plan was written** — that plan said no design-side equivalent existed; it does now, in a sibling package |
| `checkConsistency()`                                             | `OpenISDDriver`                                                                                       | Replaces `consistencyIssues()` — a rename at call sites, not new work                                                          |
| `driverRecordProblems`                                           | Not a named export, but `conformingRecordToDriver`'s own `string[]` return already IS "every problem" | Functionally covered under a different shape — no gap to fill                                                                  |
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

## 6. Driver display name and browser-list filtering — a genuine gap, its own scoped work

Found removing `myDriverName()` (`driverRepo.ts`, called `d.displayName()`, which does not exist
on the current `OpenISDDriver`). Two distinct needs, deliberately not the same shape:

1. **Done (2026-09-05).** `OpenISDDriver.displayName()` — brand + model, space-joined, `'Driver'`
   fallback when both are empty. For the editor and other single-driver contexts.
2. **Still open.** A list of names and filterable attributes across many drivers, for the
   browser/search list — a flat, queryable structure across the whole collection, not one
   driver's own method called per row. Its own scoped design work.

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
| `packages/persistence/src/repos/driverRepo.ts`                             | `OpenISDDriver`, `Engine`                                                    | **Done (2026-09-05).** `bundledEntry()` constructs (`conformingRecordToDriver`) and returns the driver; no field access. `FileEntry`'s summary columns (`Fs`, `Sd`, `Re`, `Znom`, `Pe`, `types`, `canonical`, display name) are dropped from this repo — they move wherever §6's design work lands them |
| 11 test files (`ui/test/ui/*`, `ui/test/logic/*`, `ui/test/persistence/*`) | mostly `OpenISDDriver`, `Provenance`, `Chip`, `DriverType`, `OpenISDProject` | Follow whichever production file they test moves first                                                                                                                                                                                                                                                  |

## 8. Order of work

1. `driverRepo.ts` — done: `bundledEntry()` constructs a driver (`conformingRecordToDriver`) and
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
