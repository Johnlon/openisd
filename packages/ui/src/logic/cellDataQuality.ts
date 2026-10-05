/** A field's data-quality readout: what `NumInput` binds for a cell's dq flags. Shared by every
 *  shell — the field's own `.dq`/`.provenance` carry the whole answer. */
import type {ProvenanceLetter, Readable} from '@openisd/design';

export interface DqReadout {
  readonly dq: readonly string[];
  readonly dqState: ProvenanceLetter;
}

export function dqOfCell(field: Readable<unknown>): DqReadout {
  return { dq: field.dq.map(issue => issue.text), dqState: field.provenance };
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
