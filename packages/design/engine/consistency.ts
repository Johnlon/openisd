import {decimal, pct} from './issueText.js';
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
      /** Every field this issue names — the target, plus whatever any blocked route requires or
       *  is still missing. Stated by the issue so no caller re-derives it. */
      readonly fields: readonly Q[];
      readonly text: string;
    }
  | {
      readonly kind: 'inconsistent-inputs';
      readonly target: Q;
      readonly fields: readonly Q[];
      readonly formula: string;
      readonly expected: number;
      readonly actual: number;
      readonly relative: number;
      readonly text: string;
    };

/** A stated target (a vent's `length_m`, a passive radiator's `addedMass_kg`) whose geometry is
 *  complete and internally consistent, but whose solved value is on the wrong side of zero —
 *  the geometry has a maximum reachable tuning, and the stated target sits past it. The solver
 *  writes the target `null` rather than the out-of-range number and reports the ceiling here. */
export interface TargetUnreachableIssue {
  readonly kind: 'target-unreachable';
  readonly target: string;
  readonly maxReachable_hz: number;
  readonly text: string;
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
  readonly text: string;
}

/**
 * A stated value that cannot be physical: zero, negative, or not a finite number — absolute,
 * FIELD-AGNOSTIC, shared by every box type's volume field (sealed, vented, bandpass 4th/6th rear
 * and front, ABC, passive radiator; BUG_20260927_box-volume-validity-decided-in-ui.md) AND every
 * driver spec field whose OWN physics requires strictly positive
 * (BUG_20260927_driver-bad-value-decided-in-ui.md) — both were a UI-only `v > 0` check before,
 * each duplicated per field instead of reaching the domain at all. A box volume and a driver spec
 * value are the SAME kind of fact when the floor is "must be positive" (kept exactly as entered
 * when it fails this floor, only marked), so this is one issue, not two near-duplicates. NOT every
 * driver field has this floor: which one applies is a per-field decision
 * (`openIsdDriverSpec.ts`'s `FIELD_FLOOR`) — see `NegativeValueIssue` for the weaker floor some
 * fields carry instead. Vented's OWN volume ALSO judges a plausible design BAND on top of this
 * floor (`VentedPlausibilityIssue`'s `non-physical`/`out-of-range`, a setting the user owns) —
 * this is the one check every OTHER field with this floor shares, not a replacement for that
 * richer one.
 */
export interface InvalidValueIssue {
  readonly kind: 'invalid-value';
  readonly value: number;
  readonly text: string;
}

/**
 * A stated value that cannot be physical because it is negative or not a finite number — ZERO IS
 * FINE. Some driver fields are legitimately zero (`Le_H` with no measurable inductance,
 * `alfaVC_per_K` for an idealised zero-drift coil, `Znom_ohm` in real `.wdr` files —
 * `docs/FIELD_REFERENCE.md`) but can never be negative
 * (BUG_20260927_driver-bad-value-decided-in-ui.md). The weaker sibling of `InvalidValueIssue`:
 * same kept-exactly-as-entered behaviour, different threshold.
 */
export interface NegativeValueIssue {
  readonly kind: 'negative-value';
  readonly value: number;
  readonly text: string;
}

/** Every dq-carrying issue a field can hold, whichever domain produced it. `target`/`fields` are
 *  plain `string` here, not a domain's own quantity-name union — `Readable<V>.dq` is shared
 *  across every domain and carries no quantity-name type parameter of its own, and a
 *  `CalculationIssue<Q>` for any `Q extends string` widens to this without a cast. */
export type DqIssue = CalculationIssue<string> | VentedPlausibilityIssue | TargetUnreachableIssue | OutOfRangeIssue | InvalidValueIssue | NegativeValueIssue;

// ───────────────────────────── Issues, each carrying its own sentence ───────────────────────────
//
// An issue is constructed here, never as a bare literal, because the sentence is part of what it
// IS: a caller holding a `DqIssue` can say what is wrong without an `Engine` to render it. That
// is what lets the UI read `field.dq.map(i => i.text)` and hold no engine at all
// (John, 2026-09-27).

/** A target no route can reach yet, with every blocked route's formula and what it still needs. */
export function missingDependencies<Q extends string>(
  target: Q, routes: readonly SolveRoute<Q>[],
): CalculationIssue<Q> {
  const blocked = routes.map(r => `${r.formula} (needs ${r.missing.join(', ')})`).join('; or ');
  return {
    kind: 'missing-dependencies',
    target,
    routes,
    fields: [target, ...routes.flatMap(r => [...r.required, ...r.missing])],
    text: `${target} cannot be calculated yet - state ${blocked}.`,
  };
}

/** Stated values that contradict the formula relating them — every field in the group is marked. */
export function inconsistentInputs<Q extends string>(
  target: Q, fields: readonly Q[], formula: string, expected: number, actual: number,
  relative: number,
): CalculationIssue<Q> {
  return {
    kind: 'inconsistent-inputs', target, fields, formula, expected, actual, relative,
    text: `${fields.join(', ')} disagree by ${pct(relative)}: ${formula}. Every field in the `
      + 'group is marked - correct one of them, or clear one to let it be calculated.',
  };
}

/** A driver field outside its physically possible band (D14). */
export function outOfRange(
  field: string, value: number, limit: number, side: 'below' | 'above',
): OutOfRangeIssue {
  return {
    kind: 'out-of-range', field, value, limit, side,
    text: `${field} ${decimal(value)} is ${side} the physical limit ${decimal(limit)}.`,
  };
}

/** A stated target past the maximum this geometry can produce. */
export function targetUnreachable(target: string, maxReachable_hz: number): TargetUnreachableIssue {
  return {
    kind: 'target-unreachable', target, maxReachable_hz,
    text: `${target} cannot reach this target - the maximum this geometry can reach is `
      + `${decimal(maxReachable_hz)} Hz.`,
  };
}

/** Zero, negative or not finite where the physics requires strictly positive. */
export function invalidValue(value: number): InvalidValueIssue {
  return {
    kind: 'invalid-value', value,
    text: 'Bad data: zero or less is not a physical value here. It is kept and saved exactly as '
      + 'entered - clear the field to fix it.',
  };
}

/** Negative or not finite where zero is a legitimate stated value. */
export function negativeValue(value: number): NegativeValueIssue {
  return {
    kind: 'negative-value', value,
    text: 'Bad data: less than zero is not a physical value here. It is kept and saved exactly as '
      + 'entered - clear the field to fix it.',
  };
}

/** Every field one `CalculationIssue` names — the target, plus (for `missing-dependencies`)
 *  every field any of its routes requires or is still missing. One generic answer for any
 *  domain's issue union, so a UI or domain caller never re-derives "does this issue name that
 *  field" per channel. */
/** The formula text for one issue — the single formula for `inconsistent-inputs`, or every
 *  blocked route's formula joined for `missing-dependencies`, since more than one route can be
 *  the reason a target is unavailable. */
export function issueFormula<Q extends string>(issue: CalculationIssue<Q>): string {
  if (issue.kind === 'inconsistent-inputs') return issue.formula;
  return issue.routes.map(r => r.formula).join('; or ');
}

/** The one absolute floor every positive physical quantity shares — a box volume
 *  (BUG_20260927_box-volume-validity-decided-in-ui.md) or a driver spec value
 *  (BUG_20260927_driver-bad-value-decided-in-ui.md): zero, negative or not a finite number is
 *  not physical, whatever field it is. `null` is a valid answer to "any issue?" — the value
 *  passing this check. */
export function positiveValueIssue(value: number): InvalidValueIssue | null {
  return Number.isFinite(value) && value > 0 ? null : invalidValue(value);
}

/** The weaker floor: negative or not a finite number is not physical, but zero is a legitimate
 *  stated value (BUG_20260927_driver-bad-value-decided-in-ui.md — `Le_H`, `KLe_H_sqrtHz`,
 *  `Znom_ohm`, `alfaVC_per_K`). `null` is a valid answer to "any issue?" — the value passing
 *  this check. */
export function nonNegativeValueIssue(value: number): NegativeValueIssue | null {
  return Number.isFinite(value) && value >= 0 ? null : negativeValue(value);
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
