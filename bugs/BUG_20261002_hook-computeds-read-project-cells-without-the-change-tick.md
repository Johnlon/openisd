# BUG_20261002_hook-computeds-read-project-cells-without-the-change-tick

**Status:** OPEN — ticks added, need for them unproven

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
- Tick added to hasVent, traceColour and the two currentDesign values (committed 31ddaad9).
- PR modal count / resonance / radiator: specs added, and they pass WITHOUT the tick, so the
  tick is removed again there (those cells re-read on their own).
- Specs for hasVent (AdvancedOptions-hooks.test.ts) and traceColour (MobileChartView-hooks.test.ts)
  pass with AND without the tick. The server-render test harness cannot show the staleness, so
  these specs do not prove the tick is needed.

## Still open
- A browser spec that changes the box type / cycles the trace colour on screen and reads the
  result. Only that can show the staleness. Needs Vite to start under load.
