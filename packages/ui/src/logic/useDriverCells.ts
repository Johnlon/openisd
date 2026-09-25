import type {Calculated, Entered, Readable} from '@openisd/design';
import type {DqIssue, DriverIssue} from '@openisd/design/engine';
import {Engine} from '@openisd/design/engine';
import type {SpecField} from './appState.js';
import type {ProvenanceLetter} from './fieldProvenance.js';
import {provenanceOf} from './fieldProvenance.js';

/**
 * The presentation layer's "field not present" fallback: a field that reads no value, neither
 * entered nor calculated, with no DQ. Lives here (logic) so a component never constructs a
 * field itself — that would be a runtime dependency on the domain from the view, which the
 * layering gate forbids.
 *
 * Frozen so it is safely shareable — every read is the same object.
 */
export const notAvailableCell: Readable<number | null> & Entered & Calculated = Object.freeze({
  name: '',
  value: null,
  entered: false,
  calculated: false,
  dq: Object.freeze<DqIssue[]>([]),
});

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

/**
 * Is this field REQUIRED-BUT-UNSATISFIED — named by a `missing-dependencies` issue, either as
 * the target that could not be solved or as one of the fields a blocked route still needs?
 *
 * One question, one answer, over the driver's OWN solve result — not a locally re-derived
 * notion of which fields form a group, which the engine already decided when it returned this
 * issue (`engine.issueFields`, S2-13). A component asks THIS rather than re-deriving group
 * membership itself, so the composition is unit-testable without mounting anything.
 *
 * `field` is the SCHEMA name ('Fs_hz', 'Vas_m3', …) — the same field-table keys an engine issue's own
 * fields use — so there is nothing to translate: a caller holding a display name must resolve it
 * to the schema name before asking (the driver editor's fields ARE schema names).
 */
export function fieldIsMandatoryAndUnsatisfied(issues: readonly DriverIssue[], field: string): boolean {
  const engine = new Engine();
  return issues.some(i => {
    if (i.kind !== 'missing-dependencies') return false;
    const named: readonly string[] = engine.issueFields(i);
    return named.includes(field);
  });
}
