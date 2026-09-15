import type { DriverError, SweepIssue } from '@openisd/design/engine';

/** A near-miss needs its decimal to be readable; a gross one is quoted whole. */
function pct(relative: number): string {
  const p = relative * 100;
  return p >= 100 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

/**
 * Project one `SweepIssue` (the engine's `CalculationIssue<Q>`-shaped sweep diagnostic) onto the
 * `DriverError` shape `allIssues`/`GraphPanel-hooks.ts`/`series.ts` already render — converting
 * `sweep()`'s return type (QO142) must not change what a user sees, only how the engine reports
 * it internally. Mirrors `useDriverCells.ts#consistencyNote`'s message templates so a driver
 * issue reads the same way whether it reached the user through the driver editor or a chart.
 */
export function sweepIssueMessage(issue: SweepIssue): DriverError {
  if (issue.kind === 'inconsistent-inputs') {
    return {
      level: 'error',
      field: issue.target,
      message: `${issue.fields.join(', ')} disagree by ${pct(issue.relative)}: ${issue.formula}.`,
    };
  }
  const routes = issue.routes.map(r => `${r.formula} (needs ${r.missing.join(', ')})`).join('; or ');
  return {
    level: 'error',
    field: issue.target,
    message: `${issue.target} cannot be calculated yet — state ${routes}.`,
  };
}
