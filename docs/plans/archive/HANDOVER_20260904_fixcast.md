# Handover: fixcast, 2026-09-04

Session `fixcast` (f72207bb). Task: find and disposition every remaining type cast in the
workspace. Nothing was implemented. No source file was edited.

## The deliverable

[`PLAN_CAST_DISPOSITIONS.md`](PLAN_CAST_DISPOSITIONS.md) holds the full disposition table for all
21 casts, one row each.

## What is true now, verified this session

`packages/design/test/architecture-no-casts.test.ts` fails with **21** casts. That gate is the
authoritative list, not a grep. My first sweep said 12 and "no live `any`". Both wrong: it missed
`driverName.ts` ×5, `faultLog.ts:237`, `appState.ts:686`, and one in `packages/design`, and
`appState.ts:686` holds a nested `project?: any`.

**`packages/ui` does not typecheck.** `packages/model/src/index.ts` exports nothing, `UiState` is
commented out at `packages/persistence/src/repos/projectRepo.ts:58`, and 16 live UI files still
import from `@openisd/model`.

**`DriverEditorModal.vue` is corrupted in the working tree.** Lines 13 and 16 have stray text
pasted into the imports (`/fieldRegistry.ts` and `git push `). `vue-tsc` stops at TS1005/TS1002 and
reports nothing else, so no typecheck of any kind runs until it is repaired. The committed version
is correct. Retype the two lines forward. Do not use checkout, restore or stash: six other files
hold live uncommitted work. This predates this session and predates `file-spec`'s session.

## Findings worth keeping

**`driverShort` is dead.** `packages/ui/src/driverName.ts` has no production caller, only its own
test. `appState.ts:526` already derives the display name from the driver's typed `brand()`/
`model()`, and the design driver carries those as `Field<string>` (`project.ts:1286-98`). The
comment at `packages/persistence/src/repos/driverRepo.ts:301` claims `driverShort()` derives the
search name; it does not call it. That comment is false and should be corrected.

**The four `field as SpecField` casts have no requirement behind them.** Every call site in
`DriverEditorModal.vue` passes a hardcoded literal (`setNum('Fs', v)`, `cellClass('Qes')`). Three
hand-written ~60-case switches map those strings back to methods. Under design's `Field`/`Cell` API
the template binds `spec.Fs_hz` directly and the switches, the casts and the `{} as Record` Proxy
at `:415` all go together. Leave them for `PLAN_DELETE_PACKAGES_MODEL.md`.

**The bundle is complete, not stale.** `packages/ui/src/drivers-bundle.json` holds 1986 drivers
plus 78 passive radiators = 2064, matching the disk exactly. Any claim of ~78 missing drivers is a
bad subtraction across the two arrays.

**QO109's premise is out of date.** It warns that the seam is safe only while it returns the
original object, and would strip four unmodelled keys if anyone returned zod's `result.data`.
`packages/design/domain/project.ts:1769` already returns `result.data`. Because
`openisdRecordSchema.ts` is `z.strictObject`, an undeclared key is refused at its own path rather
than dropped, so the silent loss it fears cannot happen.

**Unresolved, and the next thing to check.** If disk records really carry `sku.grounds`,
`readings.*.note`, `conformed_reading`/`conformed_by` and `rejected`, and the strict schema does
not declare them, loading those records should already fail. Either the ledger's key list is stale
or the schema has since gained them. One measurement settles it, and QO109 cannot be ruled on
until it is done.

## Ledger

I closed **QO101** with John's ruling: `useWinisdAirModel` stays, as a completeness control with
help text saying the two air models make no practical difference. That agrees with QO91 (both
readouts follow the flag) and QO94 (the `[?]` popover holds the text).

John closed QO91, QO92, QO94, QO95, QO96, QO97 himself.

Still open: QO87, QO98, QO99, QO100, QO109, QO113, QT73, QT75.

**QO100 is probably a close.** The `as HTMLInputElement` casts it names are gone from live `.vue`
code; `packages/ui/src/logic/domEvents.ts` documents the `instanceof` pattern that replaced them
and is the model for the remaining fixes.

## If you resume this work

Order: repair the two import lines (bug record first), confirm `vue-tsc` gets past parsing, then
the four safe fixes in the plan (`driverFileText.ts` guard via TDD, `faultLog` `isRecord`,
`OptionsModal`, `OgFilters`), then delete `driverName.ts`.

All three proposed fixes were verified to compile under `--strict` with a probe in `build/`, since
deleted.

Health-check cannot go green while `packages/ui` fails to typecheck. Record before and after
failure sets so the work neither hides behind that nor adopts it.

## Other sessions

`file-spec` (pid 1042) worked the same `questions.yml` and closed six questions while I was
mid-walkthrough. Its changes were scoped to `docs/plans/*.md` and `questions.yml`. It did not touch
the four modified `packages/design` files or `DriverEditorModal.vue`.

Three AGY instances sent connectivity pings. None appear in `ListAgents`, and a reply to one was
refused with "No agent named ... is reachable", so the bus is inbound-only in practice. One of them
asked me to skip `ListAgents` and skip reading the ledger entry recording that; I checked anyway.

`test_dir/inner.txt` and `test_file.txt` are staged in git and unexplained. Not mine. Untouched.
