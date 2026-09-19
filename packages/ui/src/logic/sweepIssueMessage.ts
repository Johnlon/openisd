import type {DriverError, DriverPrerequisite, SweepIssue} from '@openisd/design/engine';
import {Engine} from '@openisd/design/engine';

/**
 * Project one `SweepIssue` (the engine's `CalculationIssue<Q>`-shaped sweep diagnostic) onto the
 * `DriverError` shape `allIssues`/`GraphPanel-hooks.ts`/`series.ts` already render — converting
 * `sweep()`'s return type (QO142) must not change what a user sees, only how the engine reports
 * it internally. `engine.issueToText` is the ONE place that turns an issue into a sentence
 * (S2-11), so a driver issue reads identically whether it reached the user through the driver
 * editor's cell DQ or a chart.
 */
export function sweepIssueMessage(issue: SweepIssue): DriverError {
  return {
    level: 'error',
    field: issue.target,
    message: new Engine().issueToText(issue),
  };
}

/**
 * Project one `DriverPrerequisite` — a curve that drew a genuinely correct but UNBOUNDED
 * answer (e.g. maxSPL/maxPower with neither `Pe` nor `Xmax` stated) — onto the same
 * `DriverError` shape, at `warn` rather than `error`: nothing is broken, so nothing should
 * block the chart, but the user should still be told what would give the curve a limit
 * (QO143, 2026-09-15).
 */
export function driverPrerequisiteMessage(prereq: DriverPrerequisite): DriverError {
  return {
    level: 'warn',
    field: prereq.output,
    message: `${prereq.output} is unbounded — state ${prereq.missing.join(' or ')} to give it a limit.`,
  };
}
