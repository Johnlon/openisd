# BUG — OpenISDDriver hands the engine `Hc_mm`/`Hg_mm` in millimetres, so every field derived from motor geometry is lost

## Symptom

`packages/winisd/test/winisd-parity.test.ts` > `gap-geometry` > `Mcost`:

```
gap-geometry: openisd produced no Mcost at all, but WinISD wrote 13.18359375
```

Found while porting the parity suite off the condemned `Driver` ADT onto `OpenISDDriver` — the
old class read the `.wdr`'s own `Hc`/`Hg` keys directly and never had this translation to do.

## Evidence

- The record's canonical field names for motor geometry are `Hc_mm`, `Hg_mm`, and the other
  dimensions are likewise mm-named and mm-valued — `packages/model/src/openisdRecord.ts`'s
  `SpecSection` (`voice_coil_dia_mm`, `Hg_mm`, `Hc_mm`, `thick_mm`, `depth_mm`,
  `magnet_depth_mm`, `magnet_dia_mm`, `basket_dia_mm`, `outer_dia_mm`, `driver_volume_l`).
- The engine's own names are `Hc` and `Hg`, and it expects SI metres:
  `packages/engine/src/driver.ts:342` computes
  `const minHeight = r.Hc != null && r.Hg != null ? Math.min(r.Hc, r.Hg) : 0;`
  then `if (r.Mcost == null && r.Rme != null && r.Xmax != null && minHeight > 0)`.
- `OpenISDDriver.#stated()` (`packages/model/src/openisdDriver.ts`) builds the engine bag with
  `out[engineName(k)] = v`, and `engineName()` consults `TO_ENGINE`, which declares exactly ONE
  translation: `{ BL: 'Bl' }`. There is no entry for any `*_mm` field, and no unit scaling
  anywhere in that method.
- The serialiser already holds the correct mapping AND the correct scale factors — the same
  fields appear in `packages/winisd/src/winisdDriver.ts`'s `SPEC_TO_WDR` as
  `['Hg_mm', 'Hg', 1e-3], ['Hc_mm', 'Hc', 1e-3]` and so on. So the knowledge exists; it is
  simply not applied on the record→engine path.

## Cause

Two distinct failures on one path, both in `OpenISDDriver.#stated()`:

1. **No name translation.** `Hc_mm` reaches the engine as the key `Hc_mm`. The engine reads
   `r.Hc`, finds nothing, and `minHeight` falls to its `0` default.
2. **No unit conversion.** Even under the right name the number would be wrong by 1000×: the
   record states these fields in millimetres by their own naming convention, the engine works in
   SI metres.

`Mcost` is the visible casualty because its guard is `minHeight > 0` — with `Hc`/`Hg` missing it
is simply never computed, and the field stays absent rather than wrong. Any other engine input
named `*_mm` is silently absent in the same way.

This is NOT the engine's defect and NOT the record's: each is internally consistent. The defect is
that the ONE place that joins them does not perform the translation the join requires.

## Fix

Give `OpenISDDriver.#stated()` the record→engine mapping WITH its scale factor, for every field
whose record name or unit differs from the engine's — the same pairs the serialiser already
declares, expressed once on the model side rather than duplicated. `BL → Bl` becomes one row of
that table instead of a special case.

## Verification

`npx vitest run packages/winisd/test/winisd-parity.test.ts` — the `gap-geometry`/`Mcost` case
passes, and the full 436-case suite stays green. `gap-geometry` is the only scenario in the corpus
with non-zero `Hc`/`Hg` (every real record carries 0, which is why WinISD's own files read
`Mcost=0`), so it is the one case that exercises this path at all.
