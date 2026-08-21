# The consistency detector never checks `EBP` against `Fs`/`Qes`

# Status
OPEN 2026-08-21

## Symptom

`checkConsistency()` (`packages/engine/src/consistency.ts`) flags every other Fs-adjacent
disagreement it has the fields for — `Rme` vs `2π·Fs·Mms/Qes` (§4 row 4), `Qes` vs
`2π·Fs·Mms·Re/Bl²` (§4 row 2) — but never `EBP` against the driver's own `Fs`/`Qes`, no matter
how far apart they are. `EBP` does not appear in the `RELATIONS` table at all, in any field
position.

## Evidence

Probed directly against `checkConsistency` (temporary test in
`packages/engine/test/consistency.test.ts`, run and removed 2026-08-21 — not part of the
committed suite):

```
checkConsistency({ Fs: 40, Qes: 0.4, EBP: 300 })
  -> []                                    // EBP*Qes = 120, nothing close to Fs=40 — SILENT

checkConsistency({ Fs: 40, Qes: 0.4, Mms: 0.02, Rme: 200 })
  -> [{ formula: 'Rme = 2π·Fs·Mms/Qes', target: 'Rme', expected: 12.566…, actual: 200,
       relative: 0.937… }]                 // the SAME shape of disagreement on Rme IS flagged

checkConsistency({ Fs: 80, Qes: 0.4, Mms: 0.02, Re: 6, BL: <consistent with Fs=40> })
  -> [{ formula: 'Qes = 2π·Fs·Mms·Re/Bl²', target: 'Qes', expected: 0.8, actual: 0.4,
       relative: 1.0 }]                    // likewise flagged, as a Qes issue

checkConsistency({ Fs: 80, Qes: 0.4, Vas: 0.045, no: 0.9 })
  -> []                                    // η₀/no is deliberately excluded — already
                                            // documented in consistency.ts's own comment
                                            // (rows 14-18), not a new gap
```

`Rme` and `Qes` disagreements against `Fs` ARE caught today — `RELATIONS` already carries §4
rows 2 and 4 (targeting `Qes` and `Rme` respectively), so an entered `Rme` or `Qes` that
contradicts `Fs`/`Mms`/`Re`/`BL` surfaces as an issue on that field. `no`/η₀ is a documented,
deliberate exclusion (`consistency.ts`'s own comment, rows 14-18). `EBP` is the one member with
NO relation anywhere in `RELATIONS` — not even as a non-target field — so no combination of
entered values involving `EBP` can ever produce an issue.

## Cause

`RELATIONS` (`packages/engine/src/consistency.ts:66-105`) is WINISD_SCHEMA.md §4 transcribed by
hand, and no row for relation 12 (`Fs = EBP·Qes`) was ever added — `EBP` used to be treated as a
display-only computed value with no engine derivation route in either direction
(`BUG_20260817_engine_is_missing_two_of_winisds_fs_routes_and_has_one_winisd_does_not.md`'s
prior state). That bug added the `EBP+Qes → Fs` route to `driver.ts`, so `EBP` is now a real,
two-directional engine input exactly like `Rme`, but the consistency detector was not updated
alongside it.

## Fix (not implemented — recording only)

Add a `RELATIONS` row for §4 row 12, target `Fs`, fields `['Fs', 'EBP', 'Qes']`, predicting
`EBP·Qes` — the same shape as the existing row 4 (`Rme` target) and row 2 (`Qes` target) — so an
entered `EBP` that disagrees with the driver's own `Fs`/`Qes` is caught the same way `Rme` and
`Qes` disagreements already are.

## Verification (for the fix, not yet run)

A test pinning `checkConsistency({ Fs: 40, Qes: 0.4, EBP: 300 })` to report a `Fs`/`EBP`
consistency issue, alongside the existing "reconciles is silent" cases for a driver where `EBP`
agrees with `Fs · Qes` to within its recorded precision.
