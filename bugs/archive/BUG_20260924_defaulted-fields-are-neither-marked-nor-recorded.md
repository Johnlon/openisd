# BUG_20260924_defaulted-fields-are-neither-marked-nor-recorded

**Status:** RESOLVED

## Symptom

A driver saved by OpenISD shows "Parallel" in the driver editor's wiring control, and the
saved record contains no `VCCon` entry at all. The user cannot tell from the screen whether
Parallel was stated or assumed, and cannot tell from the file either.

Example: `winisd_drivers/db/datasheets/tang-band/w5-1138smf/openisd.json` has no `VCCon` key,
while `Dd_m` and `EBP_hz` in the same file carry `"state": "C"` with their derived values.

## Evidence

- `packages/design/domain/openisdDomain.ts:1104-1120` — `VCCon` is a `DefaultedFieldImpl`
  whose read returns `calculatedCell('', calcVCCon())` when the record states nothing. Its own
  comment: "`calcVCCon()` is a live read-time fallback, never a written-back default, so
  `calculated` has nothing to do." Nothing writes the default into the record.
- `packages/design/domain/openisdSchema.ts:163-168` — `calcVCCon()` returns
  `VoiceCoilWiring.Parallel`.
- `packages/ui/src/ui/components/DriverEditorModal.vue:818` — the wiring `<select>` binds
  `:value="driverRaw.VCCon ?? 'parallel'"` and carries no `cellClass`, so it takes none of the
  entered/calculated provenance styling every numeric cell beside it gets
  (`DriverEditorModal.vue:814` uses `:class="cellClass('numVC')"`).
- `winisd_drivers/db/datasheets/tang-band/w5-1138smf/openisd.json` — read 2026-09-24: `Dd_m`
  and `EBP_hz` are present with `state: "C"`; there is no `VCCon` key.

Same family — value shown in the app, nothing stored in the record:

| Field | Default | Site |
| ------------------------------------------ | ------------------------- | ----------------------------------------- |
| `VCCon` | Parallel | `openisdDomain.ts:1104` |
| `numVC` | 1 | `openisdDomain.ts:1124` |
| vent `count` | 1 | `openisdDomain.ts:435` |
| `envTempK` / `envHumidityPct` / `envPressurePa` | app settings Options → Environment | `openisdDomain.ts:2909, 2932, 2955` |

## Cause

Two kinds of calculated field share one state letter. Solver-derived spec values are written
into the record with `state: "C"`. `DefaultedFieldImpl` values are computed at read time and
never written, so the record is silent about them.

## Ruling (John, 2026-09-24)

No exceptions. All six fields are ordinary record-backed fields carrying the usual
Calculated / Not-available / Entered state, written to the file like every other field.

- `VCCon`, `numVC`, vent `count`: the constant default is written as `C` when nothing is
  entered.
- Env temperature / humidity / pressure: written as `C` from the app's Options value when
  nothing is entered. The project reads them through its own properties, which are `E` or `C`
  — never `N`, because the app setting itself can never be `N`: if the app had no value it
  would fill from a TypeScript constant.

John: "simply no reason for these exceptions to the rule."

## Fix

1. Replace the six `DefaultedFieldImpl` read-time fallbacks with record-backed fields whose
   default is written into the slot as calculated, the same route every solver-derived spec
   value takes.
2. The wiring control then reads its provenance mark from `spec.VCCon` like every numeric cell
   beside it, instead of being the one control with no mark.
3. Record the rule in `docs/FIELD_REFERENCE.md`: a field with a default has that default stored
   as `C`; nothing is defaulted at read time.

## Done (2026-09-24)

All six fields are record-backed. `DefaultedFieldImpl` has no users left in the domain.

- `VCCon` and `numVC`: `OpenISDDriver`'s `resolve()` stamps `calcVCCon()` / `calcNumVC()` as a
  `C` entry wherever the record states nothing.
- Vent `count`: `OpenISDProject#resolveVentCount` stamps one port as a `C` entry wherever the
  record states no count, or states one that is not a whole number of at least one — the
  2026-09-20 repair, written into the record instead of applied at read time. Applied to all
  seven vents (vented, bandpass 4th/6th, ABC).
- Env temperature / humidity / pressure: `OpenISDProject#resolveEnvironment` stamps the app's
  Options value as a `C` entry for every condition the project does not state. Re-stamped on
  every resolve, so `appSettingsChanged()` reaches an unstated project; an entered condition is
  never touched. `openisdSchema.ts` migrates the legacy bare-number environment shape — a
  stated number loads as `E`, a `null` as absent.
- The Connection control carries the same provenance mark as every numeric cell beside it.

## Verification

- A driver record that never stated a wiring loads, saves, and the saved record carries
  `VCCon` with `state: "C"` and value Parallel.
- The driver editor's wiring control carries the calculated mark for that driver and the
  entered mark once the user picks a connection.
- A project that never stated an environment saves `temperature_K` / `humidity_pct` /
  `pressure_Pa` as `C` at the app's Options values, and changing Options then re-solving
  rewrites them — no `N` state reachable for these three.
- Vent `count` and `numVC` round-trip the same way.
