import type { Cell as FieldCell } from '@openisd/design';
import type { CellState } from '@openisd/design/winisd';
import { Engine } from '@openisd/design/engine';
import type { DriverIssue } from '@openisd/design/engine';
import type { SpecField } from './appState.js';

/**
 * A sentinel `Cell<number>` with state `'not-available'` and a null value — the presentation
 * layer's "field not present" fallback. Lives here (logic) so that components never need to
 * import the domain's `createCell` constructor: that import is a runtime dependency on the
 * domain from the view, which the layering gate forbids.
 *
 * The object is frozen to make it safely shareable — all reads return the same singleton.
 */
const notAvailableCellSource = {
  name: '',
  value: null,
  state: 'not-available' as const,
  dq: (): readonly string[] => [],
};
export const notAvailableCell: FieldCell<number> = Object.freeze(notAvailableCellSource);

/**
 * Driver provenance PRESENTATION — how a field's `CellState` becomes a CSS class, and how a
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

/** TOTAL map: a new CellState member becomes a compile error here rather than an unstyled
 *  field. */
const CELL_CLASS: Record<CellState, CellClass> = {
  entered: CellClass.Entered,
  calculated: CellClass.Calculated,
  'not-available': CellClass.NotAvailable,
};

/**
 * The CSS class for one field, BY FIELD NAME. The caller supplies `cellOf` — how to reach a
 * cell in whichever model it edits — and this does the read and the mapping, so a `Provenance`
 * value never enters a component. A component naming or holding a domain value is what the
 * layering rule forbids; handing one through is the same leak the gate cannot see.
 */
export function cellClassFor<K extends string = SpecField>(cellOf: (field: K) => FieldCell<number>, field: K): CellClass {
  return CELL_CLASS[cellOf(field).state];
}

/**
 * Is this field REQUIRED-BUT-UNSATISFIED — named by a `missing-dependencies` issue, either as
 * the target that could not be solved or as one of the fields a blocked route still needs?
 *
 * One question, one answer, over the driver's OWN solve result — not a locally re-derived
 * notion of which fields form a group, which the engine already decided when it returned this
 * issue (`engine.issueFields`, S2-13). A component asks THIS rather than re-deriving group
 * membership itself, so the composition is unit-testable without mounting anything.
 */
export function fieldIsMandatoryAndUnsatisfied(issues: readonly DriverIssue[], field: string): boolean {
  const engine = new Engine();
  return issues.some(i => {
    if (i.kind !== 'missing-dependencies') return false;
    const named: readonly string[] = engine.issueFields(i);
    return named.includes(field);
  });
}
