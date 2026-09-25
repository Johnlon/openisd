import type {DriverError, DriverPrerequisite, Engine, SweepIssue} from '@openisd/design/engine';

/**
 * Project one `SweepIssue` (the engine's `CalculationIssue<Q>`-shaped sweep diagnostic) onto the
 * `DriverError` shape `allIssues`/`GraphPanel-hooks.ts`/`series.ts` already render — converting
 * `sweep()`'s return type (QO142) must not change what a user sees, only how the engine reports
 * it internally. `dqIssueText` is the ONE place that turns an issue into a sentence (S2-11), so
 * a driver issue reads identically whether it reached the user through the driver editor's cell
 * DQ or a chart.
 */
export function sweepIssueMessage(engine: Engine, issue: SweepIssue): DriverError {
  return {
    level: 'error',
    // Every `SweepIssue` variant but one names its field `target`; `OutOfRangeIssue` (D14) names
    // it `field` instead, since a range breach describes ONE entered value, never a computed
    // target several fields feed.
    field: 'field' in issue ? issue.field : issue.target,
    message: engine.dqIssueText(issue),
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
