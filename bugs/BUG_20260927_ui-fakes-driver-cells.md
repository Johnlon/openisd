# BUG_20260927_ui-fakes-driver-cells

**Status:** RESOLVED

## Symptom
The UI makes up a field. `notAvailableCell` (packages/ui/src/logic/useDriverCells.ts) is a fake
cell, and the driver editor's `cellOf` (packages/ui/src/ui/components/DriverEditorModal.vue) returns
it whenever `specFieldHandle` returns null. John, 2026-09-27: "There is no justification for creating
fake cells in the ui layer".

## Evidence
`specFieldHandle(driver, field: SpecField)` (packages/ui/src/logic/driverSpecFields.ts) returns null
for `VCCon` only; `SpecField` includes that non-numeric wiring select. `cellOf` then falls back to
`notAvailableCell`.

## Cause
The editor's numeric paths are typed over `SpecField`, which admits one non-numeric member, so the
accessor is partial and the UI papers over it with a fake cell.

## Fix
Type every numeric path over `NumSpecField` (exists) so the accessor is total (`driver.specs[field]`
with no null); `VCCon` stays on its own dropdown. Delete `notAvailableCell` and the `?? notAvailableCell`
fallback.

## Verification
`grep -rn notAvailableCell packages` finds nothing; typecheck proves the accessor total; driver
editor and Tune tests pass.

## Resolution (2026-09-27)
`specFieldHandle` (packages/ui/src/logic/driverSpecFields.ts) retyped `field: SpecField` →
`field: NumSpecField`, return type dropped its `| null` — `driver.specs[field]` is now total,
no runtime `VCCon` check. Deleted `notAvailableCell` and its import (packages/ui/src/logic/useDriverCells.ts).

Every caller retyped to `NumSpecField`, `?? notAvailableCell` deleted at each: `cellOf`/`fieldOf`/
`cellClass`/`cellVal`/`setNum`/`dqNote` (DriverEditorModal.vue), `isBadValue`/`dqNoteFor`/
`chartBlockingReasonsFor`'s `cellOf` parameter and `mandatoryFields` (DriverEditorModal-hooks.ts),
`specField` (OriginalTune-hooks.ts — its `if (!handle) throw` was dead code once the accessor is total,
deleted). `driverCellOf` in the driver-editor-units.test.ts test helper had the same
`?? notAvailableCell` pattern; fixed the same way.

`VCCon` is now excluded by NumSpecField's own type (`Exclude<SpecField, 'VCCon'>`), not a runtime
`if (field === 'VCCon') return null` — it stays on its own dropdown (`d.specs.VCCon` read
directly), never routed through this dispatch.

## Verification (done)
`grep -rn notAvailableCell packages` → nothing. `npm run typecheck` clean (design/persistence/ui).
Red first: `driverSpecFields.test.ts` rewritten to drop every `!` and the VCCon-returns-null
case — `npx tsc -p packages/ui --noEmit` failed with 9 "Object is possibly 'null'" errors against
the unfixed source, confirming the accessor was genuinely partial before the fix. Green after:
same file passes, plus useDriverCells.test.ts, DriverEditorModal-hooks.test.ts,
driver-editor-units.test.ts, OriginalTune-hooks.test.ts (81 tests) and the full packages/ui suite
(584 tests).
