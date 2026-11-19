/** A field's data-quality readout: what `NumInput` binds for a cell's dq flags. Shared by every
 *  shell — the field's own `.dq`/`.provenance` carry the whole answer. */
import type {ProvenanceLetter, Readable} from '@openisd/design';

export interface DqReadout {
  readonly dq: readonly string[];
  readonly dqState: ProvenanceLetter;
}

/** A field's marks with its warnings apart: `dq` the conflicts and flags, `warnings` the odd but
 *  kept values (an air pressure outside the normal band). A warning conflicts with nothing, so it
 *  is never said as a conflict and never drawn red (QO953.c14: "refuse impossible, warn odd"). */
export interface FieldMarks extends DqReadout {
  readonly warnings: readonly string[];
}

/** The field's flags, without its warnings (`warningsOfCell`). */
export function dqOfCell(field: Readable<unknown>): DqReadout {
  return { dq: field.dq.filter(issue => issue.kind !== 'outside-normal-band').map(issue => issue.text), dqState: field.provenance };
}

/** The field's warnings: each stated value outside its normal band, kept and used. */
export function warningsOfCell(field: Readable<unknown>): readonly string[] {
  return field.dq.filter(issue => issue.kind === 'outside-normal-band').map(issue => issue.text);
}

/** `dqOfCell` and `warningsOfCell` in one readout. */
export function marksOfCell(field: Readable<unknown>): FieldMarks {
  return { ...dqOfCell(field), warnings: warningsOfCell(field) };
}

/** The sentence a field's ⚠ shows for its flags and warnings together: the flags as `dqReason`
 *  says them, then each warning as it is, with no conflict prefix. '' when there is neither. */
export function marksReason(marks: FieldMarks): string {
  return [dqReason(marks), ...marks.warnings].filter(part => part !== '').join('; ');
}

/** The sentence a field's ⚠ shows. An entered value is one of the values in conflict, never "the"
 *  cause: a group conflict marks every member, and none is more wrong than the others. A
 *  calculated value is flagged because what it came from is. '' when nothing is flagged. */
export function dqReason(readout: DqReadout): string {
  if (readout.dq.length === 0) return '';
  const dq = readout.dq.join('; ');
  if (readout.dqState === 'E') return `Conflicts with other values: ${dq}`;
  if (readout.dqState === 'C') return `Calculated from flagged values: ${dq}`;
  return dq;
}
