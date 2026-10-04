import {inconsistentInputs} from '../../consistency.js';
import type {CalculationIssue} from '../../consistency.js';
import type {DriverWorkingSet} from '../../solvers/driverQuantities.js';
import type {Relation, RelationValues} from './Relation.js';
import type {RouteQuantity} from './SolveRoute.js';

/** A computed field's uncertainty can collapse to zero when the solve is insensitive to every
 *  entered value; this is a representation floor, not a tolerance. */
const FLOAT_NOISE = 1e-9;

/** `base` with `field` set to `value` — the one place a quantity is written into a fresh working
 *  set, so every caller shares the same assignment the compiler checks once. */
export function withQuantity(base: DriverWorkingSet, field: RouteQuantity, value: number): DriverWorkingSet {
  const next: DriverWorkingSet = {...base};
  next[field] = value;
  return next;
}

/**
 * Whether the stated values of a set of relations agree with each other, beyond their own
 * rounding. Used by the driver (all its relations) and the passive radiator (the ones among its
 * seven figures), so a relation is checked the same way wherever it applies.
 */
export class ConsistencyCheck {
  private readonly fields: readonly RouteQuantity[];

  constructor(private readonly relations: readonly Relation[]) {
    this.fields = Array.from(new Set(relations.flatMap(rel => rel.fields)));
  }

  /**
   * Every stated value's disagreement with what the OTHER stated values imply for it, beyond
   * their own combined rounding precision. `entered` is what the user stated, never a value the
   * solver derived. `solve` resolves a stated set to everything it implies. `precisionOf` is each
   * stated field's own half-width: the reading's stated precision, or half the last decimal it was
   * typed to.
   */
  check(
    entered: DriverWorkingSet,
    solve: (stated: DriverWorkingSet) => DriverWorkingSet,
    precisionOf: (field: RouteQuantity) => number,
  ): CalculationIssue<RouteQuantity>[] {
    const resolved = solve(entered);

    // Each field's own uncertainty: an ENTERED field carries its own stated precision; a COMPUTED
    // one starts at the float-representation floor and accumulates however far each entered
    // field's own rounding can move it.
    const inherited = this.inheritedWidths(entered, resolved, solve, precisionOf);
    const delta: Partial<Record<RouteQuantity, number>> = {};
    for (const field of this.fields) {
      const value = resolved[field];
      if (typeof value !== 'number') continue;
      delta[field] = entered[field] != null
        ? precisionOf(field)
        : Math.abs(value) * FLOAT_NOISE + (inherited[field] ?? 0);
    }

    const values = this.valuesFrom(resolved);
    const issues: CalculationIssue<RouteQuantity>[] = [];
    for (const rel of this.relations) {
      if (!rel.fields.every(f => typeof values[f] === 'number')) continue;
      const expected = rel.predict(values);
      if (!isFinite(expected)) continue;

      // `rel.target` is one of `rel.fields`, so `delta[rel.target]` was set above for it.
      let tolerance = delta[rel.target] ?? 0;
      for (const f of rel.fields) {
        const fieldDelta = delta[f];
        if (f === rel.target || !(fieldDelta! > 0)) continue;
        const moved = rel.predict({...values, [f]: values[f]! + fieldDelta!});
        if (isFinite(moved)) tolerance += Math.abs(moved - expected);
      }

      const actual = values[rel.target]!;
      const residual = Math.abs(expected - actual);
      if (residual > tolerance) {
        // `residual` is the gap between the two intervals' CENTRES; `tolerance` is how much of
        // that gap their own half-widths already close. What is left over, the gap between the
        // two intervals' NEAREST EDGES, is the genuine, unexplained disagreement.
        const shortfall = residual - tolerance;
        issues.push(inconsistentInputs(rel.target, rel.fields, rel.formula, expected, actual,
          shortfall / Math.max(Math.abs(actual), Math.abs(expected))));
      }
    }
    return issues;
  }

  /** Only the fields a relation reads, as a closed bag: never the full solved record. */
  private valuesFrom(resolved: DriverWorkingSet): RelationValues {
    const out: Partial<Record<RouteQuantity, number>> = {};
    for (const field of this.fields) {
      const v = resolved[field];
      if (typeof v === 'number') out[field] = v;
    }
    return out;
  }

  /**
   * How far each not-entered relation field moves when each entered one is bumped by its own
   * half-width, summed: the worst-case width the entered values' own rounding gives a derived
   * value. A field nothing moves is absent.
   */
  private inheritedWidths(
    entered: DriverWorkingSet,
    resolved: DriverWorkingSet,
    solve: (stated: DriverWorkingSet) => DriverWorkingSet,
    precisionOf: (field: RouteQuantity) => number,
  ): Partial<Record<RouteQuantity, number>> {
    const widths: Partial<Record<RouteQuantity, number>> = {};
    for (const field of this.fields) {
      const enteredValue = entered[field];
      const ownWidth = precisionOf(field);
      if (typeof enteredValue !== 'number' || !(ownWidth > 0)) continue;
      const bumped = solve(withQuantity(entered, field, enteredValue + ownWidth));
      for (const other of this.fields) {
        if (entered[other] != null) continue; // only derived quantities inherit a width
        const moved = bumped[other];
        const base = resolved[other];
        if (typeof moved === 'number' && typeof base === 'number' && isFinite(moved - base) && moved !== base) {
          widths[other] = (widths[other] ?? 0) + Math.abs(moved - base);
        }
      }
    }
    return widths;
  }
}
