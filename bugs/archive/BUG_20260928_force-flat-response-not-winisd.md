# BUG_20260928_force-flat-response-not-winisd

**Status:** RESOLVED

## Symptom
With "Force flat response" on, WinISD's transfer function is 0 dB at every frequency and its SPL
is flat (80.55 dB for the W5 sealed case down to 1 Hz). OpenISD caps the boost at 20 dB and lifts
only SPL/excursion/port velocity: at 1 Hz its TF is −62.9 dB and SPL 17.7 dB.

## Evidence
winisd_research runs/sealed-w5-flatresponse (`[SimulatorOptions] FlatResponse=1`, 2026-09-28)
against OpenISD with `forceFlatResponse` on: TF differs by 62.9 dB and SPL by 62.9 dB at 1 Hz, and
excursion is 27.9 at 1 Hz in WinISD vs 0.020 in OpenISD (the compare's units). Impedance matches to
3.2e-14 Ω. OpenISD: `engine/simulation/SimulationEngine.ts` force-flat block,
`FLAT_MAX_BOOST_DB = 20` in `engine/constants.ts`, and tfMag is untouched.

## Cause
Decoded 2026-09-29 from runs/sealed-w5-flatresponse. WinISD sets every point to the transfer
function's 0 dB (the HF asymptote, 80.547 dB here): SPL = that level, cut as well as boosted,
no ceiling; excursion scales by the same gain (×13 908 at 1 Hz); impedance is untouched. OpenISD
boosted only, up to its own passband reference, capped at 20 dB.

## Fix
`SweepParams.winisdFlatModel` (absent = WinISD): reference = the TF's 0 dB, gain = ref − SPL at
every point, uncapped. `false` keeps OpenISD's capped boost-only variant (`flatMaxBoostDb`), which
the older engine tests now state. Switch: `ProjectAdvanced.winisdFlatModel` (f65a07b8, on by default, Reset to WinISD turns it on) and the Compatibility panel's "WinISD flat response" checkbox (401c1088).

## Verification
`test/domain/force-flat-response-winisd.test.ts` against `test/fixtures/winisdFlatResponseCapture.ts`:
SPL ≤ 1e-12 relative, TF ≤ 1e-12 dB, excursion ≤ 1e-11. Red before (SPL 17.7 vs 80.5 dB at
1 Hz), green after; design suite 2383/2383.
