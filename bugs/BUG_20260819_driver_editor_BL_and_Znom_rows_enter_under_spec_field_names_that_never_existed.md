# DriverEditorModal.vue's BL and Znom rows enter/read under SpecField names that never existed

## Status
FIXED

## Symptom

`packages/ui/src/ui/components/DriverEditorModal.vue`'s BL row (line 590-594) and Znom row
(line 676-680) use the field-key strings `'Bl'` and `'Z'` — cast `as SpecField` at `setNum()`/
`cellOf()` — but `_SpecSection` (`packages/model/src/openisdRecord.ts`) has only ever declared
`BL?: _SpecEntry` and `Znom?: _SpecEntry`. `'Bl'` and `'Z'` are the physics engine's OWN
internal working names (`packages/engine/src/driver.ts`'s solver fields), never the record's.

## Evidence

`grep -n 'data-field-key="Bl"\|data-field-key="Z"' packages/ui/src/ui/components/DriverEditorModal.vue`
— both present; neither `Bl` nor (bare) `Z` is a key of `_SpecSection`.

## Cause

Same root cause as
`bugs/BUG_20260819_driver_editor_enters_dimension_fields_under_spec_field_names_that_do_not_exist.md`:
`setNum`/`cellOf`'s `(field: string)` signature casts its argument `as SpecField` with no
structural check, so a field-key string that has never matched a real `SpecField` compiles
clean and silently fails at runtime. Predates this session — not introduced by the `BL`/`Znom`
engine-vocabulary rename just completed; that rename only renamed the ENGINE's internal field
(`Bl`→`BL`, `Z`→`Znom`), which happens to now match what these two rows SHOULD have been using
all along.

## Fix

`data-field-key`, `cellClass()`, `cellVal()`, `setNum()`, `dqNote()`, and `getFieldStyle()`
arguments corrected from `'Bl'`/`'Z'` to `'BL'`/`'Znom'` in both rows.

## Verification

`npx vue-tsc -p packages/ui --noEmit` clean. Full suite passes except the pre-existing,
already-recorded/flagged failures unrelated to this change.
