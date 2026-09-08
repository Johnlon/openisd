# Plan 1 — re-architect to `ARCHITECTURE.md`

**This plan implements [`ARCHITECTURE.md`](../../ARCHITECTURE.md). Where the two disagree, the
architecture document is right and this plan is wrong.**

Plan 2 — [`PLAN_PROJECTION_PACKAGE.md`](PLAN_PROJECTION_PACKAGE.md) — builds the export function
`winisd_tools` calls. **It runs AFTER this one**, because it needs `OpenISDProject`, the alignment
types and `OpenISDPassiveRadiator` to exist before it can project them into a file.

---

## Where the code is, measured 2026-08-14

Run this before trusting any line below — the tree moves:

```
npx vitest run packages/ui/test/ui/architecture.test.ts
npx tsc -p packages/model --noEmit && npx tsc -p packages/winisd --noEmit
npx vue-tsc -p packages/ui --noEmit
```

**Done, and gated:**

- `OpenISDDriver` is the one driver model. `OpenISDRecord` is deleted as a separate exported type;
  the record shape is `OpenISDDriverJson`, the class's own constructor parameter.
- The facade pattern the target needs is proven in miniature: a single owner holds ground /
  committed / overlay, publishes OPERATIONS (`cell`, `enter`, `clear`, `toDriver`, `errors`,
  `recordToPersist`, `groundRecord`) and never hands its inner model out. Three gates prove that
  containment is total. `ManagedProject` inherits this design; it does not re-invent it.
- The store's parallel what-if implementation is DELETED. What-if exists only inside the facade,
  and a gate lists zero offences.
- `WinISDDriver` is the one `.wdr` class, both directions, with `toOpenISDRecord()` as the reader.
- Parity: 436/436 against goldens WinISD itself wrote.

**Not done — this plan:**

| Gate | State |
| --- | --- |
| `ui` imports `logic` and nothing below | RED — `DriverEditorModal.vue`, `OgTune.vue`, `OriginalShell.vue` |
| a component imports no VALUE from `@openisd/*` | RED — same three |
| no app file imports the condemned `Driver` ADT | RED — `driverSelection.ts`, `DriverEditorModal.vue` |

Six files still import from `@openisd/winisd`: `db/driverRepo.ts`, `logic/store.ts`,
`logic/useApplicationIO.ts`, `logic/wprMapping.ts`, `logic/driverSelection.ts`,
`ui/components/DriverEditorModal.vue`.

**Does not exist at all:** `OpenISDProject`, `ManagedProject`, `OpenISDPassiveRadiator`, the four
alignment types, `PresentationState`, `UrlAppState`.

---

## Why the steps run in this order

**The facade must wrap the PROJECT before the project's parts can be modelled.** Every part —
passive radiator, box, vent, alignment — needs an owner to live inside. Build `OpenISDProject` and
`ManagedProject` first (steps 1–3) and each subsequent part has somewhere to go; build the parts
first and they sit in `state.P` exactly as they do now, and have to be moved twice.

**The condemned `Driver` ADT cannot be deleted until the editor stops speaking it** (step 6). Its
blocker — `providedBy`/`comment`/`added` having no home in the model — is CLEARED: those three are
now optional fields of `OpenISDDriver`.

**Presentation state is separated LAST** (step 9) because the split is only worth doing if it
removes `projectFingerprint()`'s hand-maintained exclusion list, and that function's shape depends
on what `ManagedProject` ends up owning.

---

## The steps

### Step 1 — `OpenISDProject`, the data type

Create `packages/model/src/openisdProject.ts`. Members, per `ARCHITECTURE.md`'s data-model
diagram: `driver`, `radiator`, `box`, `vent`, `target`, `filters`, `environment`, `signal`,
`listening`, `simOptions`, `meta`.

Plain data. No Vue, no DOM. `structuredClone`-able, because `ManagedProject` clones it three ways.

**Done when:** the type exists with every member named in the diagram, and a fixture builds one.

### Step 2 — The four alignment types

`OpenISDSealedAlignment` (Vb·Fsc·Qtc), `OpenISDVentedAlignment` (Vb·Fb, owns the vent),
`OpenISDBandpass4Alignment` (rear Vb·front Vf·Ff), `OpenISDPassiveRadiatorAlignment` (Vb·Fp, owns
the radiator).

**`OpenISDBox` holds ALL FOUR at once, one ACTIVE.** Switching type makes the others DORMANT with
their data intact — nothing is cleared. A test proves it: fill a vented box, switch to sealed,
switch back, assert every port field is byte-identical.

6th-order and ABC are NOT built here — ledger QO44, and ABC has no field specification at all.

**Done when:** the round-trip test passes and no code path clears a dormant alignment.

### Step 3 — `ManagedProject`

`packages/ui/src/logic/managedProject.ts`. Holds ground / committed / overlay, each a complete
`OpenISDProject`. It is the domain object for ONE project in the left nav, and the only thing the
app talks to about a project's state.

Its contract, from `ARCHITECTURE.md` §3:

- `beginEdit` / `commitEdit` / `cancelEdit`, `beginWhatIf` / `cancelWhatIf` — no `commitWhatIf`,
  ever.
- Notification asymmetry: an edit draft is SILENT until commit; a what-if is LIVE on every change.
- `recordToPersist()` is the ONLY route to a savable record, and it cancels an active what-if
  itself — so no call site can forget the guard.

**`packages/ui/src/logic/managedDriver.ts` is DELETED in this step** — a driver-shaped facade is
the wrong shape, and leaving it beside `ManagedProject` is the two-implementations-of-one-concept
defect this whole plan exists to remove. Its file is the only thing that goes; the design it
proved is what `ManagedProject` implements at the right altitude.

Update the three containment gates to name `ManagedProject` and `OpenISDProject`.

**Done when:** the notification-count tests pass at project level — an N-field edit then commit
gives exactly ONE notification; an N-scrub what-if gives N+2; an edit that never commits gives 0.

### Step 4 — Move box, vent and PR state out of `state.P`

`state.P`'s `Vb`, `Vf`, `ventShape`, `ventD/W/H/L`, `Fb`, `Frc`, `pr*` become members of
`OpenISDProject`. `state.P.entered` — the second, hand-rolled provenance mechanism — is DELETED;
those fields use the record's own provenance like every other field.

`useVentGroup.ts` and `usePrGroup.ts` keep their solving; they operate on the project's members
instead of on a flat bag.

**This is the step that pays for `ManagedProject`:** `OgTune.vue`'s `vbSnapshot` hand-rolled undo
disappears, because cancelling the overlay restores `Vb` — `Vb` is IN the overlay.

**Done when:** `vbSnapshot` is gone, and cancelling a what-if restores a scrubbed `Vb`.

### Step 5 — `OpenISDPassiveRadiator`

A COMPONENT, so it gets the same treatment as a driver: its own class, its own
`OpenISDPassiveRadiatorJson` record, its own per-field provenance, its own catalogue entry.

`db/prLibrary.ts` returns records, never instances — the same rule as `driverRepo`.

**Done when:** a PR chosen from the library carries per-field provenance the panel can show.

### Step 6 — Migrate the editor and the picker off the condemned ADT

`DriverEditorModal.vue` and `driverSelection.ts`. The editor routes `providedBy`/`comment`/`added`
through `enterMeta`/`metaCell` and spec fields through `enter`/`cell`. `driverSelection.ts` drops
`adoptIntoProject()`/`projectDriverAsModel()` — the `.wdr`-text bridge that exists only while both
models are alive.

**Done when:** the "one driver model" gate is GREEN.

### Step 7 — DELETE `packages/winisd/src/driver.ts`

The class, its `export * from './driver.js'` in `index.ts`, and the ten test files that test the
class itself: `driver-class`, `driver-json`, `driver-derive`, `driver-hardening`,
`driver-roundtrip`, `driver-projection`, `driver-fresh-export`, `roundtrip`,
`wdr-import-fidelity`.

**Before deleting, read each for coverage that is NOT about the class.** `wdr-import-fidelity` and
`wdr-import-fidelity` asserts real `.wdr` behaviour that `WinISDDriver` now owns; that coverage moves
rather than dies.

**Done when:** `driver.ts` is gone and the suite is green without it.

### Step 8 — Route the last `ui` imports through `logic`

`OgTune.vue`, `OriginalShell.vue`, `DriverEditorModal.vue` stop importing `@openisd/engine`.
The value each needs is computed in `logic` and handed down as data — the pattern
`logic/environment.ts` and `logic/prWinIsdFields.ts` already establish.

**Done when:** both layering gates are GREEN.

### Step 9 — `PresentationState` and `UrlAppState`

Split UI state out of the store's one `state` object: `graphs`, `editDriver`, `editDriverInfo`,
`browseOpen`, `defineOpen`, `cursorF`, `pinnedF`, `cursorLocked`, `dragRange`, `yRanges`,
`driverSource`, and the whole `ui` sub-object.

**`PresentationState`** is browser-storage backed and never shared. **`UrlAppState`** composes the
URL and OWNS NO STATE — it queries the owners and asks them to re-establish.

**The split is only worth doing if it kills `projectFingerprint()`'s hand-maintained exclusion
list** — UI state must become structurally unreachable from the fingerprint, not merely omitted
from it by hand. If it leaves that list in place, it is churn.

Then fix
`bugs/BUG_20260814_address-bar-carries-no-design-state-at-all-so-the-url-cannot-share-the-design.md`
— the address bar carries no design state at all. **Diagnose before changing anything:** establish
whether the write never happens or happens and produces nothing.

**Done when:** the fingerprint cannot see UI state by construction, and a design change is visible
in the address bar with no further user action.

### Step 10 — Projects as an ordered list

`Workspace` holds `ManagedProject`s in an ordered array. `project.name` is a LABEL: two open
projects may share one. Identity is the entry's own id.

`logic/model/workspace.ts` already declares `projects: WorkspaceEntry[]` — this step PRESERVES
that and adds a gate. Anything introducing a `Map`/`Record` keyed by name is a defect.

**Done when:** a test opens two projects with the same name and both survive independently.

---

## Definition of done

- Every gate in `packages/ui/test/ui/architecture.test.ts` GREEN.
- `packages/winisd/src/driver.ts` deleted; no `DriverJSON`, `DriverRaw` or `FieldCell` in `ui`.
- `state.P` no longer holds box, vent or PR state, and `state.P.entered` is gone.
- `vbSnapshot` and every other hand-rolled per-field undo deleted.
- Parity still 436/436 — the migration must not move a single number.
- `ARCHITECTURE.md` needs no correction to describe the result.
