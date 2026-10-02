# BUG_20260927_peaking-cut-notch-nan

Status: RESOLVED (2026-09-28) — the load schema's plain `z.number()` already refuses
`NaN`/`Infinity`/`-Infinity` for every filter numeric field, in this codebase's zod (v4.5.4).
Leader ruling's fix (`.finite()` at that boundary) would be a no-op; no production code changed.
Added an exhaustive regression test covering all ten filter variants' numeric fields instead.

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

## Leader ruling (2026-09-28)
`gain = -Infinity` is unreachable through the app: every filter's own `.update()` clamps to
`FILTER_GAIN_LIMITS` (±60 dB, confirmed in `ParametricEqFilter.ts`/`StaticGainFilter.ts`/
`PeakHighpassFilter.ts`/`RaisedCosineFilter.ts`), and JSON text cannot carry `Infinity`/`NaN` at
all. The one door in is the LOAD schema (`openisdSchema.ts`'s filter shapes, `filterJsonSchema`,
~line 663) validating a JS object handed to it directly (bypassing JSON text) — e.g. a value
parsed from a `.wpr` INI field. Ruled: fix at that boundary, every filter numeric finite on load,
`.finite()` or an existing finite-number helper, verified by a test that a non-finite filter
value is rejected at load.

## Investigation (2026-09-28)
Checked the boundary directly: this codebase's zod (`zod@4.5.4`) makes plain `z.number()` refuse
`NaN`/`Infinity`/`-Infinity` already — reported as `invalid_type`, not a passed-through number.
This differs from zod v3 (where `z.number()` accepted `Infinity` and needed an explicit
`.finite()`); the schema file's `z.number()` calls are already correct for the installed version.

Verified exhaustively, not just for `gain`: built a real project through the public domain
surface (`OpenISDProject.builder`), set one filter of each of the ten variants, saved and cloned
the session to a plain object, then fed `openISDProjectSessionJsonSchema.safeParse()` — the exact
schema `OpenISDProject.fromOwprText()` calls at load — a copy with each numeric field in turn set
to `NaN`/`Infinity`/`-Infinity`. Every one of the ten variants' every numeric field (`fc`, `Q`,
`gain`, `gainPk`, `fpk`, `bwOct`, `order`, `t`, `f0`, `Q0`, `fp`, `Qp`) was rejected, in every
one of the three non-finite forms. A control case (same mutation path, a normal finite
replacement value) parses successfully, so the rejections are real, not an artefact of the test
harness.

## Fix
None needed — adding `.finite()` would be a no-op against the currently installed zod. The
`ParametricEqFilter.response` NaN this ticket ORIGINALLY reported (evaluating the cut branch's
own `0·Infinity` cross term at `fc`) is a separate, still-open concern in the filter MATH itself —
out of scope here per the leader ruling ("don't change the filter math"), and moot in practice
since a `gain = -Infinity` value can never reach that code: it is refused at the schema before
any filter object carrying it can be constructed from a load.

## Verification
`packages/design/test/domain/filter-json-schema.test.ts` — 14 tests, all passing against
unmodified code.
