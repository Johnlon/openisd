import type {Calculated, Entered, OpenISDDriver, Readable} from '@openisd/design';
import type {DriverIssue, Engine} from '@openisd/design/engine';
import type {SpecField} from '../logic/appState.js';

/**
 * Data-quality pure functions for the driver editor (DriverEditorModal.vue). Each one is
 * parameterised on `cellOf`/the draft driver rather than closing over component state, so the
 * modal's own reactive `cellOf`/`draftDriver` can be passed in without this file knowing Vue
 * exists. See DriverEditorModal.vue's "Data quality" section for the two-states-never-merged
 * rationale (NOT ENTERED vs BAD VALUE) this logic implements.
 */

export const BAD_VALUE_NOTE = 'Bad data: zero or less is not a physical value here. It is kept and saved exactly as entered — clear the field to let it be calculated instead.';

/** One data-quality reason: `subject` is the field name to highlight, `text` the rest of the
 *  sentence. Kept apart so the template can render the subject distinctly without scraping it
 *  back out of an assembled string. */
export interface DqReason {
  readonly subject: string;
  readonly text: string;
}

/** BAD VALUE: a number that cannot be physical (≤ 0). Zero is a value, not an absence. */
export function isBadValue(cellOf: (field: SpecField) => Readable<number | null> & Entered & Calculated, field: SpecField): boolean {
  const v = cellOf(field).value;
  return typeof v === 'number' && !(v > 0);
}

/** The one DQ mark per field: its reason, or '' when there is nothing to say. */
export function dqNoteFor(engine: Engine, cellOf: (field: SpecField) => Readable<number | null> & Entered & Calculated, field: SpecField): string {
  if (isBadValue(cellOf, field)) return BAD_VALUE_NOTE;
  return cellOf(field).dq.map(issue => engine.dqIssueText(issue)).join('\n');
}

/** The driver's own consistency-solve verdict — every DQ read here traces back to this. */
export function driverIssues(driver: OpenISDDriver): readonly DriverIssue[] {
  return driver.issues();
}

/** `missing-dependencies` renders a blocked-chart reason; `inconsistent-inputs` and
 *  `out-of-range` render none — every value either names is present and plotted as stated
 *  (BUG_20260924_inconsistent-inputs-claims-charts-blank). No default arm: a new
 *  `CalculationIssue` variant fails to COMPILE here rather than silently joining this list. */
function chartBlockingReason(issue: DriverIssue): readonly DqReason[] {
  switch (issue.kind) {
    case 'missing-dependencies':
      return [{subject: issue.target, text: `cannot be calculated yet — needs ${issue.routes.map(r => r.missing.join(', ')).join(' or ')}`}];
    case 'inconsistent-inputs':
    case 'out-of-range':
      return [];
  }
}

/** The mirror of `chartBlockingReason`, same no-default-arm rule: only `inconsistent-inputs`
 *  renders, stating the stated value against what the other stated values imply. */
function inconsistentInputReason(issue: DriverIssue): readonly DqReason[] {
  switch (issue.kind) {
    case 'inconsistent-inputs':
      return [{subject: issue.target, text: `${issue.formula} — stated as ${issue.actual}, the others imply ${issue.expected}`}];
    case 'missing-dependencies':
    case 'out-of-range':
      return [];
  }
}

/** What actually blanks a chart: a quantity the solver cannot derive, or a mandatory field with
 *  no value. Three lists, never merged: a missing Brand does not blank a chart, a missing Fs
 *  does not stop the driver being filed (identity reasons are the modal's own concern, not this
 *  list's), and values that merely disagree blank nothing at all —
 *  `inconsistentInputReasonsFor` carries those. */
export function chartBlockingReasonsFor(
  issues: readonly DriverIssue[],
  cellOf: (field: SpecField) => Readable<number | null> & Entered & Calculated,
): DqReason[] {
  const reasons = issues.flatMap(i => [...chartBlockingReason(i)]);
  const mandatoryFields: SpecField[] = ['Fs_hz', 'Vas_m3', 'Re_ohm', 'Sd_m2'];
  for (const field of mandatoryFields) {
    if (cellOf(field).value === null) reasons.push({subject: field, text: 'is not set'});
  }
  return reasons;
}

/** Stated values that contradict each other. Every value involved exists and every chart plots
 *  from the values AS STATED — this list is a data-quality conflict to resolve, not a blocker. */
export function inconsistentInputReasonsFor(issues: readonly DriverIssue[]): DqReason[] {
  return issues.flatMap(i => [...inconsistentInputReason(i)]);
}

export function ebpVal(driver: OpenISDDriver): number | null {
  return driver.specs.EBP_hz.value;
}
