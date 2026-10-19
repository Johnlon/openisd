import type {RouteQuantity} from './SolveRoute.js';

/** Field values by name, SI, as the solver produces them. */
export type RelationValues = Readonly<Partial<Record<RouteQuantity, number>>>;

/**
 * One equation tying driver quantities together, named once. Every route that solves it, in
 * whichever direction, carries the same relation, and the consistency check predicts `target`
 * from it. `fields` is the target first, then the other quantities the equation reads: the
 * members the consistency check reports. `predict` reads only members listed in `fields`.
 * `modelTolerance` is the share of the predicted value a datasheet may differ by with no mark,
 * for a relation that reaches `target` through other quantities' own datasheet scatter (a
 * compliance taken from Vas, Sd and the air); 0 where the equation is exact.
 */
export class Relation {
  constructor(
    readonly formula: string,
    readonly target: RouteQuantity,
    readonly fields: readonly RouteQuantity[],
    readonly predict: (v: RelationValues) => number,
    readonly modelTolerance: number = 0,
  ) {}
}
