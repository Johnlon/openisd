/** A field's data-quality readout: what `NumInput` binds for a cell's dq flags. Shared by every
 *  shell — the same three provenance shapes (entered+calculated, entered-only, solved-only). */
import type {Calculated, Entered, Readable} from '@openisd/design';
import type {ProvenanceLetter} from './fieldProvenance.js';
import {provenanceOf, provenanceOfEntry, provenanceOfSolved} from './fieldProvenance.js';

export interface DqReadout {
  readonly dq: readonly string[];
  readonly dqState: ProvenanceLetter;
}

export function dqOfCell(field: Readable<unknown> & Entered & Calculated): DqReadout {
  return { dq: field.dq.map(issue => issue.text), dqState: provenanceOf(field) };
}

/** `dqOfCell` for a field that is entered or absent and has no `Calculated`. */
export function dqOfEntry(field: Readable<unknown> & Entered): DqReadout {
  return { dq: field.dq.map(issue => issue.text), dqState: provenanceOfEntry(field) };
}

/** `dqOfCell` for a field only a solver writes — calculated or absent, no `Entered`. */
export function dqOfSolved(field: Readable<unknown> & Calculated): DqReadout {
  return { dq: field.dq.map(issue => issue.text), dqState: provenanceOfSolved(field) };
}
