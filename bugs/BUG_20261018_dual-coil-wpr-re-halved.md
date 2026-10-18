# BUG_20261018_dual-coil-wpr-re-halved

**Status:** OPEN

Recorded 18 Oct 2026 by maryu (T393 captures).

## Symptom
A WinISD project whose driver has two voice coils wired in parallel (Dayton E150HE-44 from the driver
db: `numVC=2`, `VCCon=1`, `Re=6.6`, `BL=9.8`) simulates as a different driver in OpenISD: the
impedance at 20 kHz is 3.3 Ω where WinISD shows 6.6 Ω, SPL is 6 dB off at 28 Hz and excursion doubles.
The same driver with `numVC=1` matches WinISD to 1e-13.

## Evidence
- WinISD capture vs OpenISD sweep, same `.wpr`, sealed box: winisd_research `runs/e150-sealed-nv2`,
  record `runs/sweep-t393a-sealed-e150he44-numvc2.json`. Worst: Z 3.3 Ω, Z phase 17.4° at 168 Hz,
  SPL 6.02 dB at 28 Hz, excursion ×2 (2.95 mm at 1 Hz), max power ×0.5, max SPL 3.01 dB. TF mag/phase and GD match.
- With `numVC=1` (`runs/e150-sealed-1`, `-2`): Z ≤ 4.3e-14 Ω.
- The documented rule (`docs/research/WINISD_PARITY.md` §11b): a `.wdr`/`.wpr` `Re` and `BL` are
  terminal values; OpenISD divides by the wiring factor to store per-coil values, so the terminal
  values it simulates equal the file's. The capture shows OpenISD's terminal Re is half the file's.

## Cause
⚠ unverified. Either the `.wpr` import stores the file's `Re`/`BL` as per-coil values without the
division the rule calls for (so parallel wiring halves Re again), or the sweep applies the wiring on
top of terminal values. Check whether the `.wdr` import and the `.wpr` import of the same driver give
the same terminal Re: a difference means a load-path bug.

## Fix
Import reads `Re`/`BL` as terminal values for every `numVC`/`VCCon`, as §11b says; the simulated
terminal Re equals the file's.

## Verification
- Unit test: import the E150HE-44 `.wpr` (numVC 2, parallel); terminal Re 6.6 Ω, terminal BL 9.8 T·m.
- Sweep vs the `e150-sealed-nv2` WinISD capture: Z, SPL, excursion within 1e-12.
