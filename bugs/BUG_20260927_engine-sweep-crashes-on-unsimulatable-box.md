# BUG_20260927_engine-sweep-crashes-on-unsimulatable-box

**Status:** OPEN

## Symptom
`Engine.sweep` with a bandpass 6th or ABC box throws "Cannot read properties of undefined" instead
of returning a named refusal. The engine's contract is no throws; issues come back as values.

## Evidence
`packages/design/test/engine/circuit.test.ts:88` pins the throw ("documents the actual, current
failure mode … does not endorse it"). The circuit split (2026-09-27) kept it: `boxModel` is typed on
`SimulatableBoxType`, and `solve` leaves Zbox/UD/U0 unassigned for the other two.

## Cause
`Engine.sweep`/`solve` do not call `simulatableBoxType()` themselves; only callers do.

## Fix
`Engine.sweep` (and any other entry taking a `BoxType`) narrows with `simulatableBoxType()` and
returns the refusal as an issue naming the box type; the test changes to assert that issue.

## Verification
The circuit.test.ts case asserts a returned issue for bandpass6 and abc, no throw.
