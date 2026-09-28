import type {Calculated, Entered, Readable} from '@openisd/design';
import type {SpecField} from './appState.js';
import type {ProvenanceLetter} from './fieldProvenance.js';
import {provenanceOf} from './fieldProvenance.js';

/**
 * Driver provenance PRESENTATION — how a field's provenance letter becomes a CSS class, and how a
 * consistency issue becomes tooltip text. The driver editor and Tune both read it, so Tune
 * cannot style the same driver differently from the dialog.
 *
 * Presentation only: whether a value is entered, calculated or absent is decided by the domain
 * object (`OpenISDDriver.cell()`), never here.
 */

/** The provenance CSS classes. A closed set, so an enum — never a bare string literal. */
export enum CellClass {
  Entered = 'value-e',
  Calculated = 'value-c',
  NotAvailable = 'value-n',
}

/** TOTAL map: a new `ProvenanceLetter` becomes a compile error here rather than an unstyled
 *  field. */
const CELL_CLASS: Record<ProvenanceLetter, CellClass> = {
  E: CellClass.Entered,
  C: CellClass.Calculated,
  N: CellClass.NotAvailable,
};

/**
 * The CSS class for a cell the caller already holds. `Readable<unknown>`, so a cell carrying a
 * wiring NAME rather than a number marks itself the same way a numeric one does — the dialog's
 * Connection control is the only such cell, and it is not a numeric field's business how it was
 * reached.
 */
export function cellClassOf(cell: Readable<unknown> & Entered & Calculated): CellClass {
  return CELL_CLASS[provenanceOf(cell)];
}

/**
 * The CSS class for one field, BY FIELD NAME. The caller supplies `cellOf` — how to reach a
 * field in whichever model it edits — and this does the read and the mapping, so a `Provenance`
 * value never enters a component. A component naming or holding a domain value is what the
 * layering rule forbids; handing one through is the same leak the gate cannot see.
 */
export function cellClassFor<K extends string = SpecField>(
  cellOf: (field: K) => Readable<number | null> & Entered & Calculated,
  field: K,
): CellClass {
  return cellClassOf(cellOf(field));
}

