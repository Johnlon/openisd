# BUG_20261019_winisd-bp4-group-delay-is-rounding-noise-from-200-hz

**Status:** RECORDED — WinISD bug, found by T429 B4 edit parity (E150HE-44 and W5-1138SMF). Not copied, no switch (same ruling as the 6th-order bandpass, John 2026-10-05): rounding noise cannot be reproduced in doubles.

## Symptom
WinISD's 4th-order bandpass group delay is noise from about 200 Hz up, on both drivers. The first point that leaves the 2e-3 ms bound is
220 Hz or higher (W5: 220 to 509 Hz over 10 runs; E150HE-44: 220 to 348 Hz); the last clean point is 204 Hz. The noise grows to 0.01 to 0.03 ms
around 1 to 4 kHz, on a curve of 0.00 to 0.05 ms. E150HE-44 after a Loss, Box or front-vent edit: WinISD plots
-0.0035 ms at 1.47 kHz, +0.0187 at 1.85 kHz, -0.0018 at 2.33 kHz, +0.0134 at 2.92 kHz. OpenISD draws the smooth curve.
Every other chart of the same runs matches to 1e-9.

## Evidence (T429 U7b, 20 runs: 10 per driver)
- Noise, not a trend: above the onset, WinISD minus OpenISD changes sign at 35 to 58 % of neighbouring points (a random sequence gives 50 %),
  its mean is within 0.0023 ms of zero, and its lag-1 autocorrelation is -0.21 to +0.25. A real difference would be smooth.
- Same cause as the 6th-order bandpass: the phase error implied by the group delay error is that error times 2π·2e-10 Hz (WinISD's step).
  Below 128 Hz it is 1 to 3 double-precision epsilons (1.1e-16 rad): the usual 3e-4 ms staircase.
  From 128 Hz to 2 kHz it grows as 1/|H| (|H| is the plotted transfer function): error × |H| is 1.1e-16 to 1.7e-16 in every octave from
  128 to 2048 Hz, on both drivers (error up to 1.4e-14 rad, 125 epsilons). That is about one epsilon of absolute rounding in the box terms,
  divided by a falling |H|. The onset is where |H| drops below about 0.15. It belongs to the box formula, not to a driver or an edit,
  which is why both drivers start near 200 Hz.
- The unedited base shows the same: `sweep-t393a-bp4-e150he44` (a plain load, no edit) has group delay worst 0.0258 ms at 1591 Hz, as large as
  the edit runs (0.0295 ms worst). The edits are applied the same way as the load. W5's base bp4 captures hold no group delay chart
  (`bp4-w5-1`: transfer function, impedance and front port velocity only).
- OpenISD's own double evaluation of the same step (f ± 1e-10 Hz) gives only the 3e-4 ms staircase from 200 Hz to 4 kHz, so the 30 to 125 times
  larger WinISD error comes from WinISD's evaluation order and x87 arithmetic (for bp6 it is reproduced bit for bit).
- `driver-edit-parity-w5.test.ts` and `driver-edit-parity-e150he-44.test.ts` (runs in `fixtures/winisdEditRuns.ts`): per bp4 run, group delay
  below 200 Hz is held to the normal 2e-3 ms bound and passes; group delay from 200 Hz up is `it.fails` (ten per driver).
- An earlier version of this file said the E150HE-44 noise starts near 1 kHz. That is where it is largest, not where it starts.
- Same cause as [BUG_20261005_bp6-group-delay-noise-above-1k](BUG_20261005_bp6-group-delay-noise-above-1k.md); the bp4 noise is smaller (0.03 ms against 0.15 ms).

## Fix
None in OpenISD (the f·(1 ± 1e-6) step already draws the smooth curve). Recorded in ACCURACY_IMPROVEMENTS and WINISD_PARITY beside the bp6 row.

## Verification
The twenty `it.fails` group-delay checks from 200 Hz up and the twenty passing checks below 200 Hz.
