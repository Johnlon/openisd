# BUG_20261001_chart-tick-loop-hangs-and-crashes-on-tiny-y-range

**Status:** RESOLVED

## Symptom
Spinning the LP filter cutoff froze the app, then "Something went wrong — Uncaught RangeError:
Invalid array length at Array.push". Reloading crashed again (John, 2026-10-01, openisd.app build
`index-Qa_YJlXk.js`).

## Evidence
- Deployed bundle line 313 col 25842 is the y-grid tick loop in `drawOne`
  (`packages/ui/src/ui/canvas.ts:122`): `for (v = ceil(ymin/s)*s; v <= ymax + 1e-9; v += s) push(v)`.
- Scan of every chart's y-range over LP/HP cutoffs (scratch tsx, sealed box): the VA chart
  ("Amplifier apparent load power") gets ymin 0, ymax 1.48e-20 (LP n=10 fc=1 Hz), down to
  1.5e-260 (fc=1e-12). The loop's end test `v <= ymax + 1e-9` then needs ~1e11 steps of
  ~4e-21 to pass 1e-9, so the array overflows.
- `niceTicks` (`canvas.ts:32`) has the same absolute `1e-9` margin.

## Cause
The tick loop's end margin is an absolute 1e-9, not relative to the step. Any y-range much smaller
than 1e-9 makes the loop run billions of times. The chart (and the filter that drives it) is in
the saved state, so the next load draws it again.

## Fix
`linearTicks(ymin, ymax, ph)` in `canvas.ts` counts the ticks (k0 … k0+count multiples of the
step, step-relative tolerance, at most 1000) instead of stepping a float to `ymax + 1e-9`. A zero,
reversed or non-finite range has no ticks. `drawOne` uses it. `niceTicks` (same bug, no callers)
is deleted.

## Verification
`packages/ui/test/ui/canvas.test.ts` `linearTicks`: 0 … 1.48e-20 and 0 … 1.5e-260 give a handful of
ticks; 1e18 … 1e18+256 terminates; zero/reversed/NaN/∞ ranges give none; −50 … 5 unchanged. Chart
browser specs in `original-skin.browser.spec.ts` pass.
