# DriverEditorModal.vue enters/reads 6 dimension fields under SpecField names that don't exist in `_SpecSection`

## Status
FIXED

## Symptom

`packages/ui/src/ui/components/DriverEditorModal.vue`'s dimension pane calls `setNum(field, v)` /
`cellOf(field)` with field-key strings that are cast `as SpecField` (`setNum(field: string, v)`
→ `draftDriver.value.enter(field as SpecField, v)`, line 94-99) but do not match any property of
`_SpecSection` (`packages/model/src/openisdRecord.ts`):

| Editor's field-key string | Record's actual `_SpecSection` field |
|---|---|
| `'magnetDepth'` (line 799-800) | `magnet_depth` |
| `'magnet'` (line 800) | `magnet_dia` |
| `'basket'` (line 801) | `basket_dia` |
| `'outer'` (line 802) | `outer_dia` |
| `'basketDisplacement'` (line 804) | `driver_volume` |
| `'VCd'` (line 803) | `voice_coil_dia` |

`'thick'`/`'depth'`/`'Hc'`/`'Hg'` DO currently match (`thick`, `depth`, `Hc`, `Hg` are real
`_SpecSection` fields), so those four are unaffected.

## Evidence

`grep -n "setNum('magnetDepth'\|setNum('magnet'\|setNum('basket'\|setNum('outer'\|setNum('basketDisplacement'\|setNum('VCd'" packages/ui/src/ui/components/DriverEditorModal.vue`
— all six calls present, none of the six strings appears as a property name anywhere in
`_SpecSection`.

## Cause

`setNum`'s signature is `(field: string, v: number | null)`, and the call site casts its
argument `as SpecField` (`draftDriver.value.enter(field as SpecField, v)`). The cast bypasses
TypeScript's structural check entirely, so a field-key string that has never matched any real
`SpecField` compiles clean and fails only at runtime — `OpenISDDriver.enter()` writes into
`this.#specs()[field]` keyed by whatever string it's given, silently creating a spec entry under
a key `_SpecSection` doesn't declare (or, depending on `enter()`'s exact guard, doing nothing).
Either way, a user typing into the Magnet Depth / Magnet Diameter / Basket Diameter / Outer
Diameter / Displacement Volume / Voice Coil Diameter fields in the driver editor does not
actually update the driver's real `magnet_depth`/`magnet_dia`/`basket_dia`/`outer_dia`/
`driver_volume`/`voice_coil_dia` fields, and `cellOf()`/`cellVal()` reading the same wrong key
back explains why the editor could still look self-consistent (it reads back whatever it wrote
under the wrong key) while never actually round-tripping through `.wdr` export/import or the
provenance system correctly.

## Fix

Landed alongside renaming `_SpecSection`'s 8 dimension fields to WinISD's own `.wdr` spelling
(`voice_coil_dia`→`Vcd`, `thick`→`Thick`, `depth`→`Depth`, `magnet_depth`→`MagDepth`,
`magnet_dia`→`Magnet`, `basket_dia`→`Basket`, `outer_dia`→`Outer`, `driver_volume`→`DVol` —
human ruling 2026-08-19, "I am expecting us to be using winisd nomenclature everywhere"). The
six field-key strings in `DriverEditorModal.vue` (`data-field-key`, `cellClass()`, `cellVal()`,
`setNum()`, `dqNote()` arguments) were corrected to `Thick`/`Depth`/`MagDepth`/`Magnet`/
`Basket`/`Vcd`/`DVol` — the new, correct `_SpecSection` names — rather than the old (already
broken) `thick`/`depth`/`magnetDepth`/`magnet`/`basket`/`VCd`/`basketDisplacement` strings.
`provenance.ts`'s `LABEL_TO_FIELD_KEY` and `fieldRegistry.ts`'s labels were updated to match.

## Verification

`npx vue-tsc -p packages/ui --noEmit` clean. Full suite
(`npx vitest run packages/engine/test packages/model/test packages/winisd/test packages/ui/test`):
1832/1838 passing, the 6 remaining failures pre-existing and unrelated (5 `architecture.test.ts`
findings flagged separately for human triage, 1 already-recorded last-digit `c`-constant bug).
`packages/ui/test/ui/driver-editor-units.test.ts`'s label-binding tests (which read the actual
rendered `<label>` text and resolve it back through `cellVal()`/`setNum()`) now pass for all
eight dimension fields, confirming the wiring is live, not just type-checked.
