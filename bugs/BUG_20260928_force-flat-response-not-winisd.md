# BUG_20260928_force-flat-response-not-winisd

**Status:** OPEN

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
OpenISD's force-flat is its own design (capped boost, applied to SPL only). WinISD applies an
unlimited inverse of the box response, so the TF is exactly 0 dB (⚠ the exact WinISD form is not
decoded; the TF value −9.6e-16 dB says TF/itself).

## Fix
Match WinISD by default: an uncapped inverse applied to TF as well as SPL, excursion and port
velocity. The capped variant can sit behind a WinISD-vs-conventional switch (see
docs/research/ACCURACY_IMPROVEMENTS.md).

## Verification
Fixture from runs/sealed-w5-flatresponse; engine test ≤ 1e-12 on TF, SPL, excursion.
