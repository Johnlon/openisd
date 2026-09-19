import type {MaxCurvesResult, SweepResult} from './types.js';

/** One route to a derivable quantity: the formula, everything it needs, and whatever of that
 *  is still absent. `missing` is empty exactly when the route is usable. */
export interface SolveRoute<Q extends string> {
  readonly formula: string;
  readonly required: readonly Q[];
  readonly missing: readonly Q[];
}

/**
 * One calculation's diagnostic: either a target that could not be derived (naming every route
 * that was tried and what each one is still missing), or a target whose entered value
 * contradicts what the OTHER entered values imply for it.
 */
export type CalculationIssue<Q extends string> =
  | {
      readonly kind: 'missing-dependencies';
      readonly target: Q;
      readonly routes: readonly SolveRoute<Q>[];
    }
  | {
      readonly kind: 'inconsistent-inputs';
      readonly target: Q;
      readonly fields: readonly Q[];
      readonly formula: string;
      readonly expected: number;
      readonly actual: number;
      readonly relative: number;
    };

/** Every field one `CalculationIssue` names — the target, plus (for `missing-dependencies`)
 *  every field any of its routes requires or is still missing. One generic answer for any
 *  domain's issue union, so a UI or domain caller never re-derives "does this issue name that
 *  field" per channel. */
export function issueFields<Q extends string>(issue: CalculationIssue<Q>): readonly Q[] {
  if (issue.kind === 'inconsistent-inputs') return issue.fields;
  return [issue.target, ...issue.routes.flatMap(r => [...r.required, ...r.missing])];
}

/** The formula text for one issue — the single formula for `inconsistent-inputs`, or every
 *  blocked route's formula joined for `missing-dependencies`, since more than one route can be
 *  the reason a target is unavailable. */
export function issueFormula<Q extends string>(issue: CalculationIssue<Q>): string {
  if (issue.kind === 'inconsistent-inputs') return issue.formula;
  return issue.routes.map(r => r.formula).join('; or ');
}

/** A near-miss needs its decimal to be readable; a gross one is quoted whole. */
function pct(relative: number): string {
  const p = relative * 100;
  return p >= 100 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

/** One sentence for one issue, whichever domain it comes from — the single place that turns a
 *  `CalculationIssue` into human-facing text, so the cascade DQ, the sweep error channel and the
 *  driver editor tooltip all say the same thing (S2-11). */
export function issueToText<Q extends string>(issue: CalculationIssue<Q>): string {
  if (issue.kind === 'inconsistent-inputs') {
    return `${issue.fields.join(', ')} disagree by ${pct(issue.relative)}: ${issue.formula}. `
      + `Every field in the group is marked — correct one of them, or clear one to let it be calculated.`;
  }
  const routes = issue.routes.map(r => `${r.formula} (needs ${r.missing.join(', ')})`).join('; or ');
  return `${issue.target} cannot be calculated yet — state ${routes}.`;
}

/**
 * Every named sweep output a prerequisite reference can point at — reused from
 * `SweepResult`/`MaxCurvesResult`'s own field names (never a parallel prose vocabulary such as
 * `'maximum SPL'`), so there is one name per output. A human-facing label is a presentation
 * concern for the UI hook that formats the reference, not a name the engine invents.
 */
export type SweepOutputName =
  | keyof Pick<SweepResult, 'spl' | 'phase' | 'gd' | 'exc' | 'excPR' | 'pv' | 'zmag' | 'zph'>
  | keyof Pick<MaxCurvesResult, 'maxspl' | 'maxpwr'>;

/**
 * An ADVISORY about one sweep output that was computed — `values` is present — but is degraded
 * or unbounded because the named upstream quantities are unstated; NOT a blocker, and NOT a
 * duplicated DQ. The one reachable case (QO143, 2026-09-15): `maxspl`/`maxpwr` are `+Infinity`
 * when neither `Pe_W` nor `Xmax_m` is stated — a correct answer, not a gap, so it must never be
 * reported as an error. Anything that actually BLOCKS a sweep (`values: null`) is never
 * represented here: it is the real `CalculationIssue<Q>` itself, embedded in `SweepIssue` —
 * which is why this shape needs no "blocked vs. unbounded" discriminator: blocked never flows
 * through it. The projection to a message is `packages/ui/src/logic/sweepIssueMessage.ts#driverPrerequisiteMessage`
 * (`level: 'warn'`), distinct from `sweepIssueMessage` (`level: 'error'`).
 */
export interface CalculationPrerequisite<Q extends string> {
  readonly output: SweepOutputName;
  readonly missing: readonly Q[];
}
