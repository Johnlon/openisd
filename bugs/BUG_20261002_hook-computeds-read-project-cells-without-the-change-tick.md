# BUG_20261002_hook-computeds-read-project-cells-without-the-change-tick

**Status:** FIXED 2026-10-02 (tick added to all six; only hasVent has a spec)

## Symptom
Some hook values read a project field but do not re-read when that field changes. The screen shows
the value from when it was first drawn. Sealed-box readouts had this and were fixed (see the top
comment in boxFields.ts). The Front chamber and Frc fields got the fix 2026-10-02.

## Cause
Reading `project.value` alone does not register the project's own field edits. The value must
also read `projectChanged`.

Found by scanning every computed in packages/ui/src/hooks that reads a project field and never
reads `projectChanged` (2026-10-02). Not yet shown stale in the app:

| Value | File | Reads |
|---|---|---|
| hasVent | AdvancedOptions-hooks.ts:21 | box type |
| prFsWithMassShown | PREditModal-hooks.ts:27 | PR resonance with added mass |
| count | PREditModal-hooks.ts:28 | PR count |
| radiator | PREditModal-hooks.ts:26 | PR radiator |
| traceColour | MobileChartView-hooks.ts:40 | trace colour |
| currentDesign | OriginalShell-hooks.ts:449, GraphPanel-hooks.ts:38 | driver, box type (curves also feed it) |

## Fix
For each row, first write a spec that edits the field and checks the screen. Add the tick only
where the spec fails.

## Done
- Tick added to all six values.
- hasVent has a unit spec (AdvancedOptions-hooks.test.ts). Without the tick, the value stayed
  false after the box changed to vented.
- The other five have no spec yet: the PR modal count/resonance/radiator, the mobile trace
  colour and the two currentDesign values.
