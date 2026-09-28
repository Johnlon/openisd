# BUG_20260928_three_tables_disagree_on_field_validity

**Status:** OPEN — all three tables folded in 2026-09-28; `NumInput`'s `group`/`base` props remain

## Symptom

Three separate tables say what values a driver field may hold, and they contradict each
other. Which answer a user sees depends on which one the code path happens to consult.

| Field | `FIELD_FLOOR` | `PHYSICAL_RANGE` | `UIFieldSpec` min/max |
|---|---|---|---|
| `Rms_kg_per_s` | positive (0 invalid) | lo 0.0 (0 valid) | — |
| `Znom_ohm`     | non-negative (0 is a real stated value) | lo 1.0 (0 invalid) | 0 / 64 |
| `SPL_dB`       | none (negative allowed) | 50.0 / 150.0 | 0 / 200 |
| `Dd_m`, `Hc_m`, `Hg_m`, `EBP_hz`, `fLe_hz` | positive (0 invalid) | lo 0.0 (0 valid) | — |
| `Qts`, `Qes`   | positive | lo 0.01 | min 0 |
| `Qms`          | positive | 0.1 / 50.0 | 0 / 50 |
| `Re_ohm`       | positive | 0.1 / 64.0 | 0.01 / 1000 |
| `BL_Tm`        | positive | 0.1 / 50.0 | 0 / 1000 |
| `Pe_W`         | positive | 1.0 / 20000.0 | 0 / 100000 |

`UIFieldSpec`'s numbers are also stated in a unit its own `unit` field contradicts:
`driver_Sd_cm2` is labelled cm² with `min: 0.0001, max: 10`, while the engine's band for the
same quantity is 1e-5–0.3 m², i.e. 0.1–3000 cm². `driver_Xmax_mm` is labelled mm with
`max: 0.5`, against an engine band of 0.0001–0.15 m, i.e. 0.1–150 mm.

## Evidence

Re-read this session:

- `packages/design/domain/driver/openIsdDriverSpec.ts` — `FIELD_FLOOR`, 55 entries.
- `packages/design/engine/physicalRange.ts` — `PHYSICAL_RANGE`, 22 entries.
- `packages/ui/src/logic/fields/uiFields.ts` — `UIFieldSpec`, 55 entries carrying min/max;
  lines 270, 287, 300, 304, 341 read directly for the values quoted above.

## Cause

There is no field definition. `DriverSpecFieldName` is `keyof DriverSpecsSection` — a name and
a type, nothing more — so every other fact about a field is a side table keyed by that name.
Three of them accumulated, each written for its own caller, none deriving from another.

## Fix

One field definition in `packages/design/fields/`, carrying the floor and the band as members
of each field's own entry, with the display facts (label, unit, precision) alongside them.
`FIELD_FLOOR`, `PHYSICAL_RANGE` and `UIFieldSpec`'s min/max are deleted and read from it.
Each contradiction above is a separate decision about which value is right — the merge cannot
be done mechanically.

## Verification

An architecture test that no per-field lookup table keyed by `DriverSpecFieldName` exists
outside the field definition, plus the existing `driver-value-validity.test.ts` and
`physicalRange.test.ts` green against the merged bands.

## Follow-ups found while building the registry (2026-09-28)

These are separate defects of the same shape, found while merging the UI's field table into
`packages/design/fields/field.ts`. Each is still OPEN.

**The registry decorates driver field names with a `driver_` prefix.** `Fs_hz` is the schema
key, the `OpenISDDriver.specs` property name, the `FIELD_FLOOR` key and the `PROVENANCE_MAP`
key. The registry calls the same field `driver_Fs_hz` and used to keep `Fs_hz` as an "alias".
Aliases are now deleted, so two test helpers bridge the two spellings by stripping the prefix
(`keyForLabel` and `fieldForKey` in `driver-editor-provenance-and-units.browser.spec.ts`).
Fix: rename the `driver_*` members to the schema key and delete both bridges. Safe to do now
that no lookup is by string — the compiler names every site.

**`NumInput`'s `group` and `base` props are a fourth table.** A call site passes
`group="mass"` and `group="compliance"`, and `UnitGroup` — which the registry's `unitGroup`
is typed as — has neither. `base="L"` and the registry's `unit: 'l'` are also two spellings of
one fact. Fix: derive both from the field, once `unitGroup` covers every unit-bearing field.

**A field's unit and its cell's unit disagree.** The registry calls the driver's inductance
`driver_Le_mH` and states its precision in millihenries; the cell it edits is `Le_H`, in
henries. Same for `Vas_m3`/`driver_Vas_l`, `Sd_m2`/`driver_Sd_cm2`, `Xmax_m`/`driver_Xmax_mm`,
`Mms_kg`/`driver_Mms_g`. Behaviour is unchanged by the merge — the same numbers reached the
same call sites before — but the registry's `unit` is display-space while its `limits` are
documented as SI/model space, and for these fields they are not both true.

## Progress, 2026-09-28

**Resolved.** The UI's own field table is gone; `NumberField` in `packages/design/fields` holds
every field fact. `PHYSICAL_RANGE`'s 22 bands are now `NumberField.plausible`, and
`engine/physicalRange.ts` keeps only the two checks that read them.

The nine "contradictions" were not contradictions: `plausible` sits strictly inside `limits` in
all 14 cases where the two differ, because they answer different questions — what a real driver
has, versus what the input will accept. Both are kept.

A field the scraper never researched now carries its entry band as its plausible band, so
`checkRange` and `isPhysicallyPlausible` no longer have a "no band, no check" case. One
behaviour change: `Gloss: -50` used to pass both silently and now reports out-of-range below 0.

**Also fixed:** the registry's `driver_` prefix and its false unit suffixes. 49 fields took the
driver record's own name (`driver_Vas_l` → `Vas_m3`, `driver_Le_mH` → `Le_H`), which is what
their bands were always in. The 11 with no schema key (`driver_manufacturer`, `driver_nDrivers`,
`driver_AddedMass_g`, `driver_VcTempRise_K`, …) keep the prefix.

**Also fixed:** `FIELD_FLOOR`. A number field carries its own `floor` beside its two bands, so
`Qts`'s "zero is enterable but not physical" is one fact in one place. 48 of the 55 spec fields
took their floor onto the field. Seven did not: `VCCon` is a wiring name and never a number, and
`Dia_m`, `freq_low_hz`, `freq_high_hz`, `weight_kg`, `OuterX_m` and `OuterY_m` have no registry
field at all because nobody has stated a band for them — inventing one would be inventing
physics. Their floors stay in `FLOOR_WITHOUT_FIELD`, seven entries, and
`driver-spec-floor-coverage.test.ts` fails if that table and the registry ever stop covering
every spec name between them.

**Still open:** `NumInput`'s `group`/`base` props (see above). Also: give the six band-less spec
fields registry entries, which needs John to state their bands.
