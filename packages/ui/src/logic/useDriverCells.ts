import { computed, type ComputedRef } from 'vue';
import type { CellState, Cell as FieldCell } from '@openisd/model';
import type { ConsistencyIssue } from '@openisd/engine';

/**
 * Driver provenance presentation — the ONE place the E/C/N marks and the Q-group rule are
 * expressed. The driver editor and every what-if panel read it, so a panel cannot show a
 * different verdict from the dialog for the same driver.
 *
 * A caller supplies `cellOf`: how to reach ONE field's cell in whichever model it edits —
 * the editor's local draft, or the store's effective (what-if overlay ▸ committed) model.
 * The rule below is model-agnostic and never reaches for a model itself.
 */

/** The provenance CSS classes. A closed set, so an enum — never a bare string literal. */
export enum CellClass {
  Entered = 'st-e',
  Calculated = 'st-c',
  NotEntered = 'st-n',
}

/** TOTAL map: a new CellState becomes a compile error here rather than an unstyled field. */
const CELL_CLASS: Record<CellState, CellClass> = {
  E: CellClass.Entered,
  C: CellClass.Calculated,
  N: CellClass.NotEntered,
};

export function cellClassOf(state: CellState): CellClass {
  return CELL_CLASS[state];
}

/**
 * The Q trio is a GROUP: any two of them solve the third, so no single member is required
 * on its own. All three are therefore flagged TOGETHER while fewer than two are usable —
 * flagging only the blank one would name a field that is not the problem.
 */
export const Q_GROUP: readonly string[] = ['Qts', 'Qes', 'Qms'];

/** True while fewer than two of the Q trio hold a usable value ⇒ the third cannot be solved. */
export function useQGroupIncomplete(cellOf: (field: string) => FieldCell): ComputedRef<boolean> {
  return computed(() => Q_GROUP.filter(k => {
    const v = cellOf(k).value;
    return typeof v === 'number' && isFinite(v) && v > 0;
  }).length < 2);
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
