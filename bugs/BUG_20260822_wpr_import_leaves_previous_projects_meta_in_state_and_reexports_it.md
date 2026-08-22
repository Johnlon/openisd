# .wpr import leaves the previous project's meta in state and re-exports it

Status: OPEN

## Symptom

Import a WinISD `.wpr` authored by "A. Smith", then export the project: the emitted
`[ProjectInfo]` block carries the creator/description/create-date of whichever project was
open BEFORE the import, not the imported file's values.

## Evidence

Adversarial review of the A6 rework working tree (2026-08-22, uncommitted):
- `OpenISDProject.fromWinISDProject` (`packages/model/src/openisdProject.ts:558-564`)
  correctly populates `record.meta` from the file's `[ProjectInfo]`.
- The import branch (`packages/ui/src/logic/useDesignIO.ts:216-222`) does
  `managedProject.load(project)` then sets only `state.project.name`; `state.project` is a
  plain reactive object (`store.ts:140`), not an accessor over the project, so
  `description`/`creator`/`created` keep the prior project's values.
- The export-side copy (`useDesignIO.ts:199-203`) then writes `state.project.*` INTO
  `project.meta.*` — the stale values overwrite the correct ones on the way out.

## Cause

The A6 rework deleted the old `Object.assign(state.project, o.project)` restore path
(`store.ts:472` pre-diff) without replacing the state←meta sync, and its opportunistic
"meta sync" fix copies in the wrong direction for the import case.

## Fix

After `managedProject.load(project)`, sync `state.project` FROM `project.meta`
(name still overridden by the filename, per the name↔file rule). With state kept in sync at
load, the export-side state→meta copy at `useDesignIO.ts:199-203` becomes unnecessary and
is deleted.

## Verification

Test: load a `.wpr` fixture with distinct creator/description/date while a differently-named
project is open; assert `state.project.*` matches the fixture; export and assert the
`[ProjectInfo]` block round-trips the fixture's values.
