# BUG_20261003_chart-tick-and-spinner-step-edge-cases

**Status:** OPEN — found while moving the UI chart maths into packages/design; behaviour kept as it was

## Symptom
1. `logTicks(0, 10)` throws `RangeError: Invalid array length`. A log axis starting at 0 takes `Math.log10(0)`, which is `-Infinity`.
2. `spinnerStep('0.0045')` returns `'0.00009999999999999999'` instead of `'0.0001'` (float error).

## Steps to reproduce
1. In `packages/design/test/chart/`, call `logTicks(0, 10)` from `chart/ticks.ts`. It throws.
2. In `packages/design/test/`, call `spinnerStep('0.0045')` from `fields/spinnerStep.ts`. The result has a long float tail. The same text would show in a spinner field.

## Fix
1. Reject or clamp a non-positive lower bound on a log axis before taking the log.
2. Round the step to its own number of decimals.
Write the failing test first for each.

## Done
