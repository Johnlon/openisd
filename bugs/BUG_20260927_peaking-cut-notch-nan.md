# BUG_20260927_peaking-cut-notch-nan

**Status:** OPEN

## Symptom
A peaking (parametric EQ) filter with `gain = -Infinity`, evaluated exactly at its own `fc`,
returns `NaN` for `|H|` instead of `0`. The filter's cut branch models an infinitely deep notch,
so the mathematically correct answer at `fc` is `|H| = 0` exactly — the code computes `NaN`.

## Evidence
Numerically reproduced (packages/design/engine/filters/ParametricEqFilter.ts + biquad.ts +
complex.ts's `cDiv`), `fc = 100`, `Q = 1`, `gain = -Infinity`, `f = fc`:
```
V = 10^(gain/20) = 0                       // exact
numerator   = cx(0, 394784.176...)         // finite, nonzero imaginary
denominator = cx(0, Infinity)              // a1 = w0/(V·Q) = w0/0 = Infinity
cDiv: re = (0·0 + 394784...·Infinity) / (0² + Infinity²) = Infinity/Infinity = NaN
      im = (394784...·0 − 0·Infinity) / Infinity = (0 − NaN)/Infinity = NaN
```
`0 · Infinity = NaN` inside `cDiv`'s cross term is what breaks it — found while fixing
BUG_20260927_spl-maps-nan-to-silence: a `packages/design/test/engine/sweep.test.ts` test used
this exact filter as its "|H|=0 exactly" fixture and had been passing only because the sweep's
old `fltAbs > 0 ? … : -200` guard sent NaN down the same branch as zero. Once that guard was
fixed to distinguish `=== 0` from NaN, the test failed — `fltMag` at `fc` is `NaN`, not `-200`.
Replaced with a `staticGain, gain: -Infinity` fixture (`V = 0` exactly, no division involved)
for that test.

## Cause
`ParametricEqFilter.response`'s cut branch (`V < 1`) sets the denominator's `a1` coefficient to
`w0/(V·Q)`, which is `Infinity` at `V = 0`. Evaluated at `w = w0`, the biquad's real parts
cancel to exactly `0` on both numerator and denominator, leaving a pure-imaginary/pure-imaginary
division whose cross terms hit `0·Infinity` in `cDiv`. The transfer function itself has a
genuine zero here (Q of the pole pushed to 0 bandwidth); the numeric path to it divides by an
infinite coefficient instead of taking a limit.

## Fix
Not attempted here — out of scope for the sweep.ts sentinel fix this was found under. A fix
would special-case `V === 0` (or clamp/limit before the divide) in `ParametricEqFilter.response`
so the cut branch's infinitely-deep-notch limit is taken analytically instead of falling into
`Infinity` denominator coefficients.

## Verification
Not yet — would re-run the numeric reproduction above and assert `response(fc)` is `cx(0, 0)`
(or its `cAbs` is exactly `0`) for `gain = -Infinity` at `f = fc`.
