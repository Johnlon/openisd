import { Engine } from '../../engine/index.js';
import type { CalculationIssue, DqIssue, OutOfRangeIssue } from '../../engine/index.js';
import type { Calculatable } from '../cell.js';

/** Clears `dq` on every named handle, then applies each issue's OWN formula only to the handles
 *  `engine.issueFields()` names for it — the driver's 44 independent quantities, where one
 *  relation's DQ has nothing to do with an unrelated field (S2-7d2). */
export function projectFormulaDq<Q extends string>(
    /** Every handle's own name, exactly once — `Object.keys(handles)` would answer `string[]`,
     *  not `Q[]` (TS never trusts an object's key list to match its declared type, since nothing
     *  stops one carrying extra enumerable properties at runtime), so the caller states its own
     *  field list where the compiler CAN check it: `as const satisfies readonly Q[]`. */
    fields: readonly Q[],
    handles: Readonly<Record<Q, Pick<Calculatable<unknown>, 'setDq'>>>,
    issues: readonly (CalculationIssue<Q> | OutOfRangeIssue)[],
    engine: Engine,
): void {
    const mark = (key: Q, dq: readonly DqIssue[]): void => handles[key].setDq(dq);
    // `fields` is `readonly Q[]`, always a subtype of `readonly string[]` (`Q extends string`);
    // widening the binding costs no cast. `isField` then validates an `OutOfRangeIssue.field`
    // (declared as plain `string` — D14's mark shape is shared across every domain, not just the
    // driver's own) against that same list before narrowing it to `Q`.
    const fieldNames: readonly string[] = fields;
    const isField = (candidate: string): candidate is Q => fieldNames.includes(candidate);
    fields.forEach(key => mark(key, []));
    issues.forEach(issue => {
        if ('field' in issue) {
            if (isField(issue.field)) mark(issue.field, [issue]);
            return;
        }
        engine.issueFields(issue).forEach(field => mark(field, [issue]));
    });
}
