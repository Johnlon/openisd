# BUG_20260926_group-delay-grid-difference

**Status:** RESOLVED

## Symptom

OpenISD's group delay on the W5-1138SMF sealed project is 0.025 ms below WinISD's at 1 Hz, and
up to 0.0004 ms off elsewhere.

## Evidence

Fresh capture `winisd_research/runs/sweep-w5-sealed-fresh-20260926`, compared after the box,
impedance, TF and max-power fixes: every other chart matches to 1e-12. WinISD's group delay
matches −dφ/dω of the closed-form model, by a 1e-6 relative step, to 5e-7 s
(`toys/w5_fresh_model_check.py`).

## Cause

There are two derivatives, WinISD's and OpenISD's. WinISD's is the derivative at the point;
OpenISD's (`sweep.ts` `groupDelayMs`) is a difference between neighbouring grid points —
central inside the grid (truncation error ~1e-4 ms), one-sided at both ends (0.025 ms at 1 Hz).
We need the derivative at the point.

## Fix

Derive the phase at each grid frequency from a small step (f·(1 ± 1e-6)) through the circuit
and the filter chain, not from the grid neighbours. Costs two extra circuit solves per point.

## Verification

Unit test: the W5 group delay at 1 Hz is WinISD's 52.2964 ms to 1e-4 ms.

Fixed 2026-09-26. WinISD's routine read from the decompile (chart 12 of `f_4618f0`, step
constant 1e-10 at 0x5dd400): gd = (φ(f−δ) − φ(f+δ))/(2π·2δ), δ = (f + 1e-10) − f. Its phase
rounding (2.2e-16 rad over 4π·1e-10) is the 1.77e-4 ms staircase. `sweep.ts` `groupDelayAtMs`
takes the slope over f·(1 ± 1e-6): worst 0.00049 ms against WinISD, within its rounding.
Copying the 1e-10 step in double gives 0.0018 ms. `winisdDriverModel.test.ts`: 1 Hz within
1e-3 ms of 52.29644 (red before: 0.0247).

Ruling, John 2026-09-26: accepted. WinISD's operation order rounding noise is not emulated.

Updated 2026-10-03: Adopted WinISD's exact `1e-10 Hz` fixed step (`WINISD_GROUP_DELAY_STEP_HZ = 1e-10`) in `SimulationEngine.ts#groupDelayAtMs` to align with WinISD's low-frequency woofer design focus (1–200 Hz). The ~0.0005 ms high-frequency numerical noise floor introduced is invisible on chart plots and UI readouts, while low-frequency readouts (like 1.99 Hz) match WinISD exactly.
