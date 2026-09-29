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
