# BUG_20261002_hook-computeds-read-project-cells-without-the-change-tick

**Status:** FIXED 2026-10-03 — hasVent and traceColour needed the tick (proven red/green); the rest were not stale

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
- Specs run the hook client-side (test/hooks/runHook.ts), where computeds cache. A server render
  (renderToString) recomputes on every read and cannot show a stale value.
- hasVent and traceColour: each spec fails without the tick and passes with it. Ticks kept.
- PR modal count / resonance: the spec passes without a tick (those cells re-read on their own).
  Ticks removed there.
- currentDesign (OriginalShell-hooks.ts, GraphPanel-hooks.ts): not stale. It also reads
  curvesData, which re-fires on every project change. Ticks removed; a spec in
  GraphPanel-hooks.test.ts keeps the box-type behaviour pinned.
