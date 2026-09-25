# BUG — Gloss has no TO_ENGINE/FROM_ENGINE entry, so every caller reaches it by casting `'loss'` past SpecField

# Status
FIXED 2026-08-17

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

Ruled 2026-08-17 (QO53): a translation-layer entry (`TO_ENGINE: { Gloss: 'loss' }`) would keep
the split alive under a mapping instead of removing it. Fixed by making the engine compute
under `Gloss` directly — `packages/engine/src/driver.ts:322` now `setVal('Gloss', ...)`,
`packages/engine/src/types.ts:78` now `Gloss?: number`. `TO_ENGINE`/`FROM_ENGINE`
(`packages/model/src/openisdDriver.ts`) need no entry at all: `engineName('Gloss')` falls
through to `'Gloss'` by identity, same as any other field with one name. Every `'loss'` call
site changed to `'Gloss'`, cast-free:
`packages/ui/src/ui/components/DriverEditorModal.vue` (`data-field-key`, `cellClass`,
`cellVal`, `setNum`, `dqNote`), `packages/ui/test/ui/driver-editor-units.test.ts` (both
`'loss' as SpecField` casts removed), `packages/engine/test/advanced-figures.test.ts`
(`r.loss` → `r.Gloss` throughout; the "must not invent a second key" assertion now checks for
a stray `loss` key instead of a stray `Gloss` one), `packages/ui/src/logic/provenance.ts`
(`PROVENANCE_MAP` keyed `Gloss`, `LABEL_TO_FIELD_KEY.Gloss: 'Gloss'`). The two `.wdr`-bridge
maps that translated the OLD engine key to the wire key (`DERIVED_TO_WDR` in
`packages/winisd/src/winisdDriver.ts`, `ENGINE_ONLY` in
`packages/winisd/test/winisd-parity.test.ts`) had their `loss`/`Gloss` entries deleted — both
fall through to identity (`?? k` / `?? field`) now that the names agree.

## Verification

`npx tsc --noEmit` clean on `packages/engine`, `packages/winisd`, `packages/model`; `vue-tsc
-p packages/ui --noEmit` shows only pre-existing `store.ts` errors from a concurrent session's
uncommitted work (confirmed via `git stash`, unrelated to this field). Targeted run —
`packages/engine/test/advanced-figures.test.ts`, `packages/winisd/test/winisd-parity.test.ts`,
`packages/ui/test/ui/driver-editor-units.test.ts` — 487/487 pass. Wider suite (`packages/engine
packages/winisd packages/model packages/ui/test/logic packages/ui/test/ui`, browser specs
excluded): 1801/1806 pass; the 5 failures are pre-existing and unrelated (vent-area validation
in `store.ts`, `OgTune.vue`/`OriginalShell.vue` importing `@openisd/engine` directly in
`architecture.test.ts` — both already `M` in `git status` before this change).
