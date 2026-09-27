# BUG_20260927_spl-maps-nan-to-silence

**Status:** OPEN

## Symptom
A NaN radiated pressure shows on the SPL (and filter magnitude) chart as −200 dB silence instead of
reaching the non-finite check. Found by the passive-radiator worker (2026-09-27): with the new
`SweepParams.Fr` absent, a test that looks only at SPL saw −200 dB, not NaN.

## Evidence
`packages/design/engine/sweep.ts:297` `spl.push(pm > 0 ? 20·log10(pm/P0) : -200)` — `NaN > 0` is
false, so NaN takes the silence branch. Same at :287 for `fltMag`.

## Cause
The −200 dB sentinel is meant for |p| = 0 exactly; the guard also catches NaN.

## Fix
Map only `pm === 0` to −200; let NaN pass through so `classifyFinite` reports it. Same for `fltAbs`.

## Verification
Unit test: a sweep with NaN pressure yields NaN SPL and a `classifyFinite` issue naming SPL.
Other arrays (phase, impedance) already carry the NaN, so the sweep as a whole is still flagged
today; the SPL chart alone is what hides it.
