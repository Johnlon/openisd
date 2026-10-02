# BUG_20261001_port-velocity-chart-draws-a-pr-box-overlay

**Status:** RESOLVED

## Symptom
Two projects open, one vented and one passive-radiator, on the port air velocity chart: the PR
project also draws a curve, though a PR box has no port (John, 2026-10-01).

## Evidence
- `BoxEngine.chartsFor('box-passive-radiator')` has no `RearPort`/`FrontPort`/`IntraPort`.
- `series.ts` `buildPlotData` draws every visible compare design on the chart it is asked for,
  with no check that the design's box type has that chart.

## Cause
There are two lists of designs, the chart's and the box type's. `chartsFor(box)` says which charts a
box type has; `buildPlotData` ignores it for overlays, so a box draws whatever its sweep holds for a
quantity it does not have.

## What the PR line was
For a PR box the engine's port-velocity array holds the passive radiator cone's own peak velocity,
√2·|U|/Sd (m/s): a real quantity, but not air through a port, so it does not belong on this chart.

## Fix
`buildPlotData` (`series.ts`) drops every design whose box type's `BoxEngine.chartsFor` does not
include the chart (John: "hide lines entirely for boxes of inapplicable types"). The box engine
decides; the chart only asks.

## Verification
`series-multi-design.test.ts`: a PR overlay on `RearPort` draws nothing; a vented overlay still
does; a PR overlay still draws on SPL.
