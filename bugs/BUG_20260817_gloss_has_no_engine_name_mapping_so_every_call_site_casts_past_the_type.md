# BUG — Gloss has no TO_ENGINE/FROM_ENGINE entry, so every caller reaches it by casting `'loss'` past SpecField

## Symptom

Nothing in the type system stops a caller reaching the cone-sag field by its RECORD name.
`OpenISDDriver.cell('Gloss' as SpecField)` compiles and returns `{value: null, state: 'N'}` even
on a driver the solver has fully derived — silently wrong, not a type error. Every real call
site instead reaches it by the engine's OWN internal key, forced past the type checker:

    packages/ui/src/ui/components/DriverEditorModal.vue:cellVal('loss')   -- `field as SpecField`
    packages/ui/test/ui/driver-editor-units.test.ts:d.cell('loss' as SpecField)

`'loss'` is not a member of `SpecField` (`keyof SpecSection`), so every one of these needs an
explicit cast to compile at all.

## Cause

The record schema declares this field as `Gloss` (`packages/model/src/openisdRecord.ts:201`,
matching WinISD's own wire name). The engine computes and stores it under a DIFFERENT literal
key: `packages/engine/src/driver.ts:323`, `setVal('loss', G_STANDARD / ((TAU * r.Fs) ** 2 * r.Xmax))`.

`OpenISDDriver.cell()` (`packages/model/src/openisdDriver.ts:278-286`) is built to bridge exactly
this kind of split — `derived().fields[engineName(field)]`, where `engineName()` consults
`TO_ENGINE`. Every OTHER renamed field has an entry there: `BL: 'Bl'`, and the mm-suffixed
dimension fields (`Hc_mm: 'Hc'`, `thick_mm: 'Thick'`, …). `Gloss`/`loss` has NO entry in
`TO_ENGINE` or `FROM_ENGINE` (`openisdDriver.ts:131-142`). So the translation the rest of the
model relies on does not cover this field, and callers route around the gap by naming the
engine's key directly instead of the record's.

## Fix

Add the missing pair — `TO_ENGINE: { Gloss: 'loss' }`, `FROM_ENGINE: { loss: 'Gloss' }` — and
change every call site currently keyed `'loss'` (with its `as SpecField` cast) to the record's
real name `'Gloss'`, cast-free. `Gloss?: SpecEntry` already exists on `SpecSection`, so
`cell('Gloss')` needs no cast once the map exists.

## Verification

Not attempted here — found while porting `driver-editor-units.test.ts` off the deleted `Driver`
ADT (`bugs/BUG_20260816_typecheck_red_driver_editor_units_test_imports_the_deleted_Driver_ADT.md`),
ported it, and kept the SAME `'loss' as SpecField` shape the app already uses at its other call
sites rather than fixing the mapping mid-port. `npm run typecheck` is green with the port as
shipped; the missing-map fix here still needs to be applied and the casts removed.
