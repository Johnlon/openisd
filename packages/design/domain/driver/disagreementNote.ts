import type {CalculationIssue} from '../../engine/index.js';
import {NumberField} from '../../fields/field.js';

/** A box's label and its value in the box's own unit, as the screen writes them: "Fs", "34.94 Hz". */
function labelOf(name: string): string {
    return NumberField.named(name)?.label ?? name;
}

function valueOf(name: string, si: number): string {
    const field = NumberField.named(name);
    return field === undefined ? String(si) : `${field.format(si)} ${field.unitLabel()}`.trim();
}

/** "A, B and C". */
function listed(names: readonly string[]): string {
    return names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The popup of a box whose value disagrees with the others in its relation (QO534, John 11 Nov 2026: "all get the mark"):
 *  which boxes disagree, and what the maths gives for the target from the others. Every box named carries the same mark.
 *  "Fs, Mms and Cms disagree by 12.7%: Fs = 1/(2π·√(Mms·Cms)) gives Fs 34.92 Hz, the box says 40.00 Hz. Correct one of them, or clear one to let it be calculated."
 *  The gap is the engine's, as main printed it (BUG_20261104_driver-consistency-gap-shown-as-zero: never 0.0%).
 *  Any other issue is returned as it is. */
export function withDisagreementNote<Q extends string>(issue: CalculationIssue<Q>): CalculationIssue<Q> {
    if (issue.kind !== 'inconsistent-inputs') return issue;
    const target = labelOf(issue.target);
    const text = `${listed(issue.fields.map(labelOf))} disagree by ${issue.gap}: ${issue.formula} gives ${target} ${valueOf(issue.target, issue.expected)}, `
        + `the box says ${valueOf(issue.target, issue.actual)}. Correct one of them, or clear one to let it be calculated.`;
    return {...issue, text};
}
