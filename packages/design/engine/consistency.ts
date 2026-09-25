import type {MaxCurvesResult, SweepResult} from './types.js';
import type {VentedPlausibilityIssue} from './plausibility.js';

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

/** A stated target (a vent's `length_m`, a passive radiator's `addedMass_kg`) whose geometry is
 *  complete and internally consistent, but whose solved value is on the wrong side of zero —
 *  the geometry has a maximum reachable tuning, and the stated target sits past it. The solver
 *  writes the target `null` rather than the out-of-range number and reports the ceiling here. */
export interface TargetUnreachableIssue {
  readonly kind: 'target-unreachable';
  readonly target: string;
  readonly maxReachable_hz: number;
}

/** An entered driver field outside its physically possible band (D5/D14) — `PHYSICAL_RANGE`'s
 *  own `lo`/`hi`, not a plausibility opinion. Shares the `'out-of-range'` literal with
 *  `VentedPlausibilityIssue`'s own variant (same event, two different domains); the two are
 *  never confused because their OTHER fields differ (`field`/`limit`/`side` here,
 *  `quantity`/`min`/`max` there) — every switch on `DqIssue.kind` narrows the `'out-of-range'`
 *  case to the union of both and tells them apart with `'field' in issue`. */
export interface OutOfRangeIssue {
  readonly kind: 'out-of-range';
  readonly field: string;
  readonly value: number;
  readonly limit: number;
  readonly side: 'below' | 'above';
}

/** Every dq-carrying issue a field can hold, whichever domain produced it. `target`/`fields` are
 *  plain `string` here, not a domain's own quantity-name union — `Readable<V>.dq` is shared
 *  across every domain and carries no quantity-name type parameter of its own, and a
 *  `CalculationIssue<Q>` for any `Q extends string` widens to this without a cast. */
export type DqIssue = CalculationIssue<string> | VentedPlausibilityIssue | TargetUnreachableIssue | OutOfRangeIssue;

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

/** One sentence for one calculation issue, whichever domain it comes from — the single place
 *  that turns a `CalculationIssue` into human-facing text, so the cascade DQ, the sweep error
 *  channel, the driver editor tooltip and the persisted debug trail (`cell.ts#writeEntryDq`)
 *  all say the same thing (S2-11). */
export function issueToText<Q extends string>(issue: CalculationIssue<Q>): string {
  if (issue.kind === 'inconsistent-inputs') {
    return `${issue.fields.join(', ')} disagree by ${pct(issue.relative)}: ${issue.formula}. `
      + `Every field in the group is marked - correct one of them, or clear one to let it be calculated.`;
  }
  const routes = issue.routes.map(r => `${r.formula} (needs ${r.missing.join(', ')})`).join('; or ');
  return `${issue.target} cannot be calculated yet - state ${routes}.`;
}

/** A near-miss needs its decimal to be readable; a gross one is quoted whole. */
function pct(relative: number): string {
  const p = relative * 100;
  return p >= 100 ? `${Math.round(p)}%` : `${p.toFixed(1)}%`;
}

/** Readable at a glance: one decimal for anything a person would read as a number, two
 *  significant figures for the very small values an extrapolated alignment produces. */
function decimal(v: number): string {
  if (!Number.isFinite(v)) return String(v);
  return Math.abs(v) < 0.1 && v !== 0 ? v.toPrecision(2) : String(Math.round(v * 10) / 10);
}

/** The value as the user reads it on screen: volumes in litres, tunings in hertz. */
function quantified(quantity: VentedPlausibilityIssue['quantity'], value: number): string {
  switch (quantity) {
    case 'Vb': return `${decimal(value * 1000)} L`;
    case 'Fb': return `${decimal(value)} Hz`;
  }
}

function subject(quantity: VentedPlausibilityIssue['quantity']): string {
  switch (quantity) {
    case 'Vb': return 'Box volume';
    case 'Fb': return 'Tuning';
  }
}

/** Every one of these sentences ends in the same fact, because it is the fact that decides what
 *  a reader does next: the number is not a bug, it is WinISD's own answer, kept deliberately. */
const PARITY = 'The alignment formula was extrapolated outside its design range; WinISD gives '
  + 'the same answer, and OpenISD keeps it rather than quietly changing it.';

/** One sentence for one plausibility issue — the wizard readout and the project cell say the
 *  same thing. */
export function plausibilityToText(issue: VentedPlausibilityIssue): string {
  const value = quantified(issue.quantity, issue.value);
  if (issue.kind === 'non-physical') {
    return `${subject(issue.quantity)} is ${value} - not a physical value. ${PARITY}`;
  }
  const band = `${quantified(issue.quantity, issue.min)} - ${quantified(issue.quantity, issue.max)}`;
  return `${subject(issue.quantity)} is ${value}, outside the plausible ${band} band set in `
    + `Settings. ${PARITY}`;
}

/** One sentence for a target the solver could not reach — the geometry is complete and
 *  consistent, but the stated target sits past the maximum this geometry can produce. */
export function targetUnreachableToText(issue: TargetUnreachableIssue): string {
  return `${issue.target} cannot reach this target - the maximum this geometry can reach is `
    + `${decimal(issue.maxReachable_hz)} Hz.`;
}

/** One sentence for a driver field outside its physically possible band (D14). */
export function outOfRangeToText(issue: OutOfRangeIssue): string {
  return `${issue.field} ${decimal(issue.value)} is ${issue.side} the physical limit `
    + `${decimal(issue.limit)}.`;
}

/** One sentence for any `DqIssue`, whichever shape it is — the single dispatch a caller uses
 *  instead of checking `kind` itself. `'out-of-range'` is narrowed further by `'field' in
 *  issue`: the literal is shared by `OutOfRangeIssue` and `VentedPlausibilityIssue`'s own
 *  out-of-range variant (see `OutOfRangeIssue`'s own doc comment). */
export function dqIssueText(issue: DqIssue): string {
  switch (issue.kind) {
    case 'missing-dependencies':
    case 'inconsistent-inputs':
      return issueToText(issue);
    case 'non-physical':
      return plausibilityToText(issue);
    case 'out-of-range':
      return 'field' in issue ? outOfRangeToText(issue) : plausibilityToText(issue);
    case 'target-unreachable':
      return targetUnreachableToText(issue);
  }
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
