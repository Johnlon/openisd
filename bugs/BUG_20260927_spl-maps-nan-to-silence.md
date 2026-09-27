# BUG_20260927_spl-maps-nan-to-silence

**Status:** RESOLVED

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

## Fix (2026-09-27)
`packages/design/engine/sweep.ts`: both guards changed from `x > 0 ? … : -200` to
`x === 0 ? -200 : …` — `cAbs` never returns negative, so `=== 0` catches exactly the same
zero-magnitude case as `> 0` did, but now lets NaN fall through to the real formula (which
correctly produces NaN) instead of the silence branch. Two guards changed:
- `spl.push(pm === 0 ? -200 : 20 * Math.log10(pm / P0))` (was `pm > 0 ? … : -200`)
- `fltMag.push(fltAbs === 0 ? -200 : 20 * Math.log10(fltAbs))` (was `fltAbs > 0 ? … : -200`)

No other `> 0 ? … : sentinel` guard on a plotted array in this file needed the same fix:
`pv.push(area ? … : 0)` guards a divisor (box area), not a magnitude, so it never hides a
NaN pressure/velocity; `groupDelayAtMs`'s `cAbs(above) === 0 || cAbs(below) === 0` already
tests `=== 0`, so NaN already fell through correctly there.

Two pre-existing tests turned out to be false positives of this exact bug — both asserted
"still finite"/"-200 dB" for inputs that actually produce NaN, and only passed because the
bug hid that NaN as the -200 sentinel:
- `packages/design/test/engine/sweep.test.ts` — the fltMag "exact spectral null" test used a
  peaking filter at gain=-Infinity, which is genuinely NaN at its own fc (a `0·Infinity` inside
  `cDiv`'s cut-branch division, not an exact zero) — filed separately as
  BUG_20260927_peaking-cut-notch-nan.md. Replaced with a `staticGain, gain: -Infinity` fixture
  (`V = 0` exactly, no division).
- `packages/design/test/engine/circuit.test.ts` — "passive radiator: an absent prRms... still a
  finite sweep" omitted `Fr` (the PR's own tuning), which `circuit.ts:353` already documents as
  poisoning the sweep with NaN when absent — exactly this bug's own origin case. Fixed the
  fixture to state `Fr` via `engine.prTuning(...)`, isolating the test to what it actually
  checks (prRms's absence alone).

## Verification (2026-09-27)
- `npm run typecheck`: design/persistence/ui all ok.
- New tests (packages/design/test/engine/sweep.test.ts): eg=NaN → spl is NaN at every point
  (not -200); classifyFinite's message names SPL; eg=0 still gives -200 unchanged. Mirror tests
  for fltMag with a NaN filter gain.
- `npx vitest run packages/design --reporter=dot`: 94 test files, 2188 tests, all passing.
