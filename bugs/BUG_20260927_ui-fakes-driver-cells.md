# BUG_20260927_ui-fakes-driver-cells

**Status:** OPEN

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
