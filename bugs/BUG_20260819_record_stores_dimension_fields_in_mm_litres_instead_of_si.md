# The `openisd.yml` record stores 10 dimension fields in mm/litres, not SI — human ruling: this is a bug

# Status
OPEN

## Symptom

`packages/model/src/openisdRecord.ts`'s `_SpecSection` declares 10 fields whose canonical
NAME and STORED VALUE are millimetres/litres, not the SI (metres/m³) every other field in the
record uses:

```
Hc_mm, Hg_mm, voice_coil_dia_mm, thick_mm, depth_mm, magnet_depth_mm,
magnet_dia_mm, basket_dia_mm, outer_dia_mm, driver_volume_l
```

Confirmed by `bugs/BUG_20260814_openisddriver-passes-mm-named-dimension-fields-to-the-engine-untranslated-and-unscaled.md`
(a defect this exact mismatch already caused once: the record→engine join silently lost
motor-geometry fields because nobody converted mm to metres on that path) and by this session's
`TO_ENGINE_SCALE`/`SPEC_TO_WDR` tables, both of which exist SOLELY to convert these 10 fields
into the SI both `.wdr` and `@openisd/engine` already use natively.

## Human ruling (2026-08-19)

> "The record (openisd.yml) — BUG — it must be SI."

The record's own mm/litre storage convention for these 10 fields is the defect, not a design
choice to accommodate. Every OTHER field in the record is already SI; these 10 are the sole
exception, and that exception is what forces two separate conversion tables to exist at all
(record→engine, record→`.wdr`) for a boundary that would not need to exist if the record were
uniformly SI like everything downstream of it.

## Cause

Not investigated in this session — presumably a decision in the Python scraper
(`winisd_tools`, a sibling repo, not this one) to store physical dimensions in the units a
datasheet prints them in (mm) for human readability, without a parallel SI-canonical field.

## Scope (why this is not a local fix)

- **This repo (`openisd`):** `_SpecSection`'s field definitions, `TO_ENGINE`/`TO_ENGINE_SCALE`/
  `SPEC_TO_WDR` in `packages/model/src/openisdDriver.ts` (all three exist because of this), the
  driver editor UI (`packages/ui`) likely displays/enters these fields in mm for human
  usability today — if the record becomes SI-stored, the UI needs its OWN display-only mm
  conversion instead of storage-level mm, a real UI change, not just a rename.
- **`winisd_tools` (sibling repo, NOT this one):** the scraper/model that actually WRITES these
  fields into every driver record on disk stores them in mm today. Fixing the record's own
  schema without fixing the writer just reintroduces the bug on the next scrape/regenerate.
- **Existing data:** every already-scraped `driver.yml`/`openisd.yml` on disk holds mm values
  under these field names. A schema change here needs the "regenerate-records" workflow (a
  named skill in this session's toolset) run afterward, not a silent reinterpretation of
  existing stored numbers as SI.

## Fix

Not applied — reported per bug-first rule, and explicitly NOT attempted in this session given
the cross-repo scope above. Needs a scoped plan (likely a multi-repo, multi-session piece of
work): decide the new field names/shape in `openisdRecord.ts`, fix the `winisd_tools` writer to
match, regenerate every affected record, then delete `TO_ENGINE_SCALE`'s mm entries and
`SPEC_TO_WDR`'s corresponding scale factors (both collapse to `1` once the record is uniformly
SI) and update the driver editor UI to do display-only mm conversion instead of storage-level.

## Human ruling (2026-08-21)

"Schedule it now." Proceed with the multi-repo migration plan above. `BUG_20260814_openisddriver-
passes-mm-named-dimension-fields-to-the-engine-untranslated-and-unscaled.md` (the immediate
mm-not-translated symptom) is explicitly NOT getting a separate stopgap fix — it waits for this
migration to make it moot, per the same ruling session.

## Measured consumer impact (2026-08-22) — this is LIVE, not a future risk

Counted directly in the shipped artifact `packages/ui/src/drivers-bundle.json` (1654 bundled
records, regenerated this session under the QO79 gate):

| key present in shipped bundle | records |
|---|---|
| `voice_coil_dia_mm` | 1613 |
| `Hc_mm` | 817 |
| `Hg_mm` | 652 |
| `depth_mm` | 540 |
| `outer_dia_mm` | 509 |
| `basket_dia_mm` | 502 |
| `driver_volume_l` | 380 |
| `thick_mm` | 354 |
| `magnet_dia_mm` | 126 |
| `magnet_depth_mm` | 101 |
| **any WinISD-SI name** (`Vcd`/`Hg`/`Hc`/`Thick`/`Depth`/`MagDepth`/`Magnet`/`Basket`/`Outer`/`DVol`) | **0** |

`_SpecSection` (`packages/model/src/openisdDriver.ts:226-233`) declares ONLY the WinISD-SI
names. TypeScript types are erased at runtime, so nothing throws: the reader simply looks up a
key that is not there and the field reads as absent. **The app therefore drops motor-geometry
data for up to 1613 of the 1654 bundled drivers today** — silently, with no error surfaced. This
is the same failure mode `BUG_20260814_openisddriver-passes-mm-named-dimension-fields-to-the-engine-untranslated-and-unscaled.md`
recorded once already on the engine join; the corpus side of it was never closed.

Consequence for sequencing: the winisd_tools rename + SI migration (that repo's
`BUG_20260822_dimension_field_names_diverge_from_openisd_winisd_naming_ruling.md`) must land
BEFORE the V8-bridge differential (`winisd_tools/DESIGN.md` §12.8 step 4) and before B11's
bundle rebuild — a differential run against today's corpus measures records that are about to
change under it.

## Verification

Not yet — no fix applied. Closure additionally requires: the bundle re-counted after migration
shows 0 old-name occurrences and non-zero WinISD-SI names, and a spot-checked driver's motor
geometry reaches the engine.
