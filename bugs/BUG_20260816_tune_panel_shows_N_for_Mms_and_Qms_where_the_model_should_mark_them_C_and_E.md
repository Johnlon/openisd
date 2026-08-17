# Tune panel marks Mms `N` and Qms `N` where the model should mark them `C` and `E`

## Symptom

With a driver loaded and the Tune panel open, cells that carry a value are marked **Not in
play** instead of Calculated / Entered:

- `Mms`, derived from the T/S set, reports state `N`; expected `C`.
- `Qms`, one of three entered Q values, reports state `N` and renders
  `st-n de-input-mandatory de-input-empty`; expected `st-e`.

## Evidence

`packages/ui/test/logic/whatif-panel-fields.browser.spec.ts`, run with `--workers=1`:

    QO11.1 Tune: Mms and Bl are editable and override the calculation
      whatif-panel-fields.browser.spec.ts:55
      expect((await cell(page, 'Mms')).state).toBe('C')
      Expected: "C"   Received: "N"

    QO11.3 Tune: a blank Q autocalculates from the other two
      whatif-panel-fields.browser.spec.ts:106
      expect(qms).toHaveClass(/st-e/)
      Received string: "st-n de-input-mandatory de-input-empty"

The other 4 tests in the file pass, so the panel itself renders and its plumbing works — the
marks are wrong, not the component.

## Cause

Not established. The state comes from the driver record's cells, and three files on that path
carry uncommitted working-tree changes from the OpenISD-model migration:

    M packages/model/src/openisdDriver.ts
    M packages/model/src/openisdRecord.ts
    M packages/engine/src/consistency.ts

The same migration removed `packages/winisd/src/driver.ts` and its barrel export, which is
what leaves `npm run typecheck` red (see
`BUG_20260816_typecheck_red_driver_editor_units_test_imports_the_deleted_Driver_ADT.md`).
Whether these marks are a defect in that in-flight work or a separate fault has NOT been
determined, and asserting either without testing it would be a guess.

## Why it was invisible

Both tests were failing earlier in `beforeEach` on the deleted `.skin-picker`, and then on
the Tune panel throwing `fieldRegistry: no field "BL"`. With both fixed, the assertions run
for the first time and these are what they report.

## Fix

Determine which of the three modified files sets the cell state for a solved `Mms` and an
entered `Qms`, and whether the committed behaviour differs. Owned by whoever is running the
model migration.

## Verification

`whatif-panel-fields.browser.spec.ts` QO11.1 and QO11.3 pass.
