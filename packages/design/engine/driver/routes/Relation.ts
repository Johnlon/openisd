import type {RouteQuantity} from './SolveRoute.js';

/** Field values by name, SI, as the solver produces them. */
export type RelationValues = Readonly<Partial<Record<RouteQuantity, number>>>;

/**
 * One equation tying driver quantities together, named once. Every route that solves it, in
 * whichever direction, carries the same relation, and the consistency check predicts `target`
 * from it. `fields` is the target first, then the other quantities the equation reads: the
 * members the consistency check reports. `predict` reads only members listed in `fields`.
 */
export class Relation {
  constructor(
    readonly formula: string,
    readonly target: RouteQuantity,
    readonly fields: readonly RouteQuantity[],
    readonly predict: (v: RelationValues) => number,
  ) {}
}
