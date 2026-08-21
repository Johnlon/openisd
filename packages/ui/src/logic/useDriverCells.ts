import { Provenance } from '@openisd/model';
import type { Cell as FieldCell, SpecField } from '@openisd/model';
import { isQGroupField } from '@openisd/engine';
import type { ConsistencyIssue } from '@openisd/engine';

/**
 * Driver provenance PRESENTATION — how a field's `Provenance` becomes a CSS class, and how a
 * consistency issue becomes tooltip text. The driver editor and every what-if panel read it, so
 * a panel cannot style the same driver differently from the dialog.
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

/** TOTAL map: a new Provenance member becomes a compile error here rather than an unstyled
 *  field. */
const CELL_CLASS: Record<Provenance, CellClass> = {
  [Provenance.Entered]: CellClass.Entered,
  [Provenance.Calculated]: CellClass.Calculated,
  [Provenance.NotAvailable]: CellClass.NotAvailable,
};

/**
 * The CSS class for one field, BY FIELD NAME. The caller supplies `cellOf` — how to reach a
 * cell in whichever model it edits — and this does the read and the mapping, so a `Provenance`
 * value never enters a component. A component naming or holding a domain value is what the
 * layering rule forbids; handing one through is the same leak the gate cannot see.
 */
export function cellClassFor(cellOf: (field: SpecField) => FieldCell, field: SpecField): CellClass {
  return CELL_CLASS[cellOf(field).state];
}

/** A near-miss needs its decimal to be readable; a gross one is quoted whole. */
function pct(relative: number): string {
  const p = relative * 100;
  return p >= 100 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

/**
 * The DQ tooltip for one field, or '' when nothing about it disagrees. The mark appears on
 * EVERY member of an inconsistent group, so the text names the whole group and says which way
 * and by how much it is out — "inconsistent" on its own tells the human nothing to act on.
 */
export function consistencyNote(issues: readonly ConsistencyIssue[], field: string): string {
  const mine = issues.filter(i => i.fields.includes(field));
  if (mine.length === 0) return '';
  return mine.map(i =>
    `${i.fields.join(', ')} disagree by ${pct(i.relative)}: ${i.formula}. `
    + `Every field in the group is marked — correct one of them, or clear one to let it be calculated.`
  ).join('\n');
}

/**
 * Is this field REQUIRED-BUT-UNSATISFIED — i.e. a Q-trio member while the trio cannot solve?
 *
 * One question, one answer. The two facts behind it — which fields form the trio, and whether
 * it can solve — are both the domain's: the engine derives `Q_GROUP_FIELDS` from its own Qts
 * relation, and the driver reports `NotAvailable` for `Qts` when fewer than two members are
 * usable. Neither is restated here.
 *
 * A component asks THIS rather than the two parts, so the composition is unit-testable without
 * mounting anything, and no component imports the engine or holds a `Provenance`.
 */
export function fieldIsMandatoryAndUnsatisfied(
  cellOf: (field: SpecField) => FieldCell, field: string,
): boolean {
  return isQGroupField(field) && cellOf('Qts').state === Provenance.NotAvailable;
}
