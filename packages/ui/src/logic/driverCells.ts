import type {ProvenanceLetter, Readable} from '@openisd/design';

/**
 * Driver provenance PRESENTATION — how a field's provenance letter becomes a CSS class. The
 * driver editor and Tune both read it, so Tune cannot style the same driver differently from
 * the dialog. Whether a value is entered, calculated or absent is the field's own answer
 * (`Readable.provenance`), never decided here.
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

/** The CSS class for a cell. `Readable<unknown>`, so a cell carrying a wiring NAME rather than
 *  a number marks itself the same way a numeric one does — the dialog's Connection control is
 *  the only such cell. */
export function cellClassOf(cell: Readable<unknown>): CellClass {
  return CELL_CLASS[cell.provenance];
}
