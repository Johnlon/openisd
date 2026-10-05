import type {DriverWorkingSet} from '../../solvers/driverQuantities.js';
import type {Air} from '../../air.js';
import type {Relation} from './Relation.js';

/** A quantity a route can produce or read: every numeric member of the working set. */
export type RouteQuantity = Exclude<keyof DriverWorkingSet, 'wiring' | 'numVC'>;

/** The working set with the named inputs known to be present. */
export type WithInputs<I extends RouteQuantity> =
  Readonly<DriverWorkingSet> & Readonly<Required<Pick<DriverWorkingSet, I>>>;

/** One way of working out a quantity from others. */
export interface DriverRoute {
  readonly target: RouteQuantity;
  /** Accepts any result, a computed zero or NaN included. The solver writes only positive finite
   *  values otherwise. */
  readonly keepsNonPositive: boolean;
  /** The equation this route solves, shared with every other route that solves it; null where the
   *  consistency check has no relation for it. */
  readonly relation: Relation | null;
  /** What this route gives `working`: null where it does not apply, that is the target is already
   *  set, an input is missing, or the route's own guard fails. */
  value(working: Readonly<DriverWorkingSet>, air: Air): number | null;
}

export class SolveRoute<I extends RouteQuantity> implements DriverRoute {
  constructor(
    readonly target: RouteQuantity,
    private readonly inputs: readonly I[],
    private readonly formula: (v: WithInputs<I>, air: Air) => number | null,
    private readonly guard: (v: WithInputs<I>) => boolean = () => true,
    readonly keepsNonPositive: boolean = false,
    readonly relation: Relation | null = null,
  ) {}

  /** This route, solving `relation`. */
  inRelation(relation: Relation): SolveRoute<I> {
    return new SolveRoute(this.target, this.inputs, this.formula, this.guard, this.keepsNonPositive, relation);
  }

  private ready(working: Readonly<DriverWorkingSet>): working is WithInputs<I> {
    return working[this.target] == null && this.inputs.every(input => working[input] != null);
  }

  value(working: Readonly<DriverWorkingSet>, air: Air): number | null {
    return this.ready(working) && this.guard(working) ? this.formula(working, air) : null;
  }
}
