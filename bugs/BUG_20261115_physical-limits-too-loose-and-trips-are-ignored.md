# BUG_20261115_physical-limits-too-loose-and-trips-are-ignored

**Status:** OPEN (not done in T821: the limits move many records' alerts and the data-quality ratchet; a separate decision).
Copied from winisd_tools branch `impossible-dimensions`, `bugs/BUG_20261115_openisd-physical-limits-too-loose-and-trips-are-ignored.md`
(https://github.com/Johnlon/openisd/issues/517). The bounds table is that branch's `scrapers/scrapers/lib/physical_limits.py`.

## Symptom
1. Impossible values pass the app's own check. `packages/design/fields/field.ts` gives each dimension/weight field an input
   `limits` band and no `plausible` band, so the consistency check uses the input band:
   `weight_kg` 0..500 kg, `Outer_m`/`Basket_m`/`OuterX_m`/`OuterY_m`/`Depth_m`/`MagDepth_m`/`Magnet_m` 0..5 m, `Vcd_m` 0..1 m,
   `DVol_m3` 0..1 m3, `Thick_m` 0..0.3 m. Evidence in the committed snapshot:
   Peerless TG9FC02-04 weight 240 kg and GBX-65X140N25AL00-04 423 kg (grams read as kg) pass; only NSM-0515R00-04 (740) and
   NSM-0515R02-16 (745) trip. Dayton DSA115-8 Basket 2.377 m and Purifi PTT10.0X04-NAB-01 / PTT10.0X08-NAB-01 MagDepth 3.98 m
   (calculated by `engine/dvolRelation.ts` `magDepthFromDims`, denominator `S - 3*Magnet^2` = 0.00083 m2) pass. Only Accuton
   C158-6-851 Outer 8.158 m trips (limit 5 m) and is shown as state N.
2. Where a limit DID trip, nothing happened. Every trip is one `dq.alert` line ("... is above the physical limit ...") counted by
   `scripts/dqRatchet.mjs` in the same pile as ~2,300 "values disagree" lines, and the ratchet only refuses a RISE of a kind. 44
   such lines are in `winisd_drivers/snapshot/datasheets/*/*/dq.alert` today (`grep -H -i "physical limit"`): Wavecor tweeter Fs
   410,000 to 780,000 Hz, Accuton and Volt Mms/Cms/Qms/Rms 0, Dayton Le -0.00055, Dayton and Eminence Vas 4.2 and 2.1 m3, Peerless
   Cms 9e-8, Dayton and Tang Band Xmax 0. Nobody looked for at least nine days.

## Steps to reproduce
1. `grep -n "weight_kg" -A12 packages/design/fields/field.ts`: weight 0..500 kg, dimensions 0..5 m, no `plausible` band.
2. Load Peerless TG9FC02-04 (weight 240 kg) or Dayton DSA115-8 (Basket 2.377 m).
3. Observed: no range warning. Expected: an impossible-value warning.

## What the limits should be
The scraper's table, `winisd_tools/scrapers/scrapers/lib/physical_limits.py`, is one row per field with the reason for each and is
tight enough to mean "cannot be a loudspeaker driver". The app's `plausible` band for every dimension and weight field should be
that table (weights and dimensions: weight_kg 0.001..100 kg; Basket/Outer/OuterX/OuterY 0.010..1 m; Depth 0.005..0.6 m;
MagDepth 0.001..0.3 m; Magnet 0.005..0.4 m; Thick 0.0005..0.05 m; Hc 0.0001..0.1 m; Hg 0.0003..0.08 m; Vcd 0.005..0.25 m;
DVol 1e-5..0.05 m3), not a copy of the input range.

## What should happen when one trips
A trip is not a disagreement. It must be its own `dq.alert` kind (for example prefix `IMPOSSIBLE`) that `dqRatchet.mjs` allows ZERO
of, except for records individually ruled in a committed exceptions file with the ruling's words. A ratchet that starts at today's
count is exactly what hid the 44.

## Also
- Done in T821 (`BUG_20261115_calculated-dimension-contradicts-its-own-geometry`): the inverse routes refuse a result outside
  `0 < MagDepth < Depth`.
- Add `out-of-physical-range` to `PARSED_REJECTION_REASONS` in `domain/openisdSchema.ts`. The scraper now writes
  `rejected: "out-of-physical-range"` with the number it read (`lib/record_registries.py` `RejectedRead`); until the app knows the
  reason, `driverRecordConverter.ts` raises "unrecognised rejection reason" for each, which raises the ratchet for the kind.
