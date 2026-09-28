# BUG_20260928_three_tables_disagree_on_field_validity

**Status:** OPEN

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
