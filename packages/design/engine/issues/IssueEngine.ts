/**
 * The issues area of the engine: the constructors of every `DqIssue` a caller outside the
 * engine may need to build, each with its own sentence already in it, and the formula text of
 * one. The functions themselves live in `consistency.ts`/`plausibility.ts` because every solver
 * inside the engine calls them directly; this area publishes them, unchanged, as the door.
 */
import type {
  CalculationIssue, FillRoute, InvalidValueIssue, NegativeValueIssue, OutOfRangeIssue, RequiredValueIssue, SolveRoute,
  TargetUnreachableIssue,
} from '../consistency.js';
import {
  inconsistentInputs, issueFormula, missingDependencies, nonNegativeValueIssue, outOfRange,
  positiveValueIssue, requiredPositiveIssue, targetUnreachable,
} from '../consistency.js';
import type {VentedDesignQuantity, VentedPlausibilityIssue} from '../plausibility.js';
import {nonPhysicalQuantity, quantityOutOfBand} from '../plausibility.js';

export interface IssueEngine {
  /** A target no route can reach yet, naming every blocked route and what it still needs. */
  missingDependencies<Q extends string>(target: Q, routes: readonly SolveRoute<Q>[]): CalculationIssue<Q>;
  /** Stated values that contradict the formula relating them — every field in the group is marked. */
  inconsistentInputs<Q extends string>(
    target: Q, fields: readonly Q[], formula: string, expected: number, actual: number, relative: number,
  ): CalculationIssue<Q>;
  /** A driver field outside its physically possible band (D14). */
  outOfRange(field: string, value: number, limit: number, side: 'below' | 'above'): OutOfRangeIssue;
  /** A stated target past the maximum this geometry can produce. */
  targetUnreachable(target: string, maxReachable_hz: number): TargetUnreachableIssue;
  /** A vented-alignment quantity that is zero, negative or not finite. */
  nonPhysicalQuantity(quantity: VentedDesignQuantity, value: number): VentedPlausibilityIssue;
  /** A vented-alignment quantity outside the design band the user owns in Settings. */
  quantityOutOfBand(quantity: VentedDesignQuantity, value: number, min: number, max: number): VentedPlausibilityIssue;
  /** The floor every positive physical quantity shares: zero, negative or non-finite is not
   *  physical, whatever field it is — every box type's volume field and every driver spec field
   *  share this one constructor (BUG_20260927_box-volume-validity-decided-in-ui.md,
   *  BUG_20260927_driver-bad-value-decided-in-ui.md). Vented's own volume additionally judges a
   *  design band on top of this floor — `VentedEngine.volumeIssue`, which is not this. */
  positiveValueIssue(value: number): InvalidValueIssue | null;
  /** `positiveValueIssue` for a value the owner must state and has left blank: blank says so,
   *  naming `label` and what to enter — and, for `fill: 'alignment'`, the Alignment button. Every box volume. */
  requiredPositiveIssue(label: string, value: number | null, fill?: FillRoute): RequiredValueIssue | InvalidValueIssue | null;
  /** The weaker floor some driver fields carry instead: negative or non-finite is not physical,
   *  but zero is a legitimate stated value. Which floor applies to which field is the field's own
   *  `NumberField.floor`. */
  nonNegativeValueIssue(value: number): NegativeValueIssue | null;
  /** The formula text for one issue — the single formula for `inconsistent-inputs`, or every
   *  blocked route's formula joined for `missing-dependencies`. */
  issueFormula<Q extends string>(issue: CalculationIssue<Q>): string;
}

export class IssueEngineImpl implements IssueEngine {
  readonly missingDependencies = missingDependencies;
  readonly inconsistentInputs = inconsistentInputs;
  readonly outOfRange = outOfRange;
  readonly targetUnreachable = targetUnreachable;
  readonly nonPhysicalQuantity = nonPhysicalQuantity;
  readonly quantityOutOfBand = quantityOutOfBand;
  readonly positiveValueIssue = positiveValueIssue;
  readonly requiredPositiveIssue = requiredPositiveIssue;
  readonly nonNegativeValueIssue = nonNegativeValueIssue;
  readonly issueFormula = issueFormula;
}
