# BUG_20260926_group-delay-grid-difference

**Status:** OPEN

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
