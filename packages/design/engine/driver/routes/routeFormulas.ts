import {DRIVER_SOLVE_ROUTES} from './DriverRoutes.js';
import {RADIATOR_ROUTES} from './RadiatorRoutes.js';
import type {DriverRoute, RouteQuantity} from './SolveRoute.js';

/** One way the engine works out a quantity, as the Driver Editor's formula panel shows it: the route's formula and the
 *  quantities it reads. */
export interface RouteFormula {
  readonly formulaText: string;
  readonly inputs: readonly RouteQuantity[];
}

/** Each quantity's routes as formulas, keyed by the quantity's name, in the order the solver tries them; a quantity no
 *  route works out has no key. */
export type RouteFormulas = Readonly<Record<string, readonly RouteFormula[]>>;

function formulasOf(routes: readonly DriverRoute[]): RouteFormulas {
  const byTarget: Record<string, RouteFormula[]> = {};
  for (const route of routes) {
    if (!Object.hasOwn(byTarget, route.target)) byTarget[route.target] = [];
    byTarget[route.target].push(Object.freeze({formulaText: route.formulaText, inputs: route.inputs}));
  }
  return Object.freeze(byTarget);
}

/** The driver's formulas: one per route in `DRIVER_SOLVE_ROUTES` (T902: the panel shows these, never a copy of its own). */
export const DRIVER_ROUTE_FORMULAS: RouteFormulas = formulasOf(DRIVER_SOLVE_ROUTES);

/** A passive radiator's formulas: one per route in `RADIATOR_ROUTES`, the routes among its own figures. */
export const RADIATOR_ROUTE_FORMULAS: RouteFormulas = formulasOf(RADIATOR_ROUTES);
