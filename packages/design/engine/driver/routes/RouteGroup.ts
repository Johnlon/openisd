import type {DriverWorkingSet} from '../../solvers/driverQuantities.js';
import {AIR_WORKING_NAMES} from '../../air.js';
import type {AirState, AirWorkingName} from '../../air.js';
import type {DriverRoute, RouteQuantity} from './SolveRoute.js';

const MAX_PASSES = 10;

/**
 * An ordered list of routes run to a fixed point. In each pass every route in turn gives its value
 * against the working set as the earlier routes left it; a value is written only into a null
 * target, and only when it is finite and above zero (a rejected value leaves the target null so a
 * later route can still fill it). A quantity handed in is never overwritten.
 */
export class RouteGroup {
  constructor(private readonly routes: readonly DriverRoute[]) {}

  /** `stated` plus everything the routes derive, in `air`. The result is a superset of the input,
   *  except `c_m_per_s`/`roo_kg_per_m3`: those are `air`'s, whatever `stated` says (John,
   *  2026-10-05: a driver record's own c and roo feed no calculation). When `air` is not
   *  available they are absent, so every route that reads them does not run, and every route that
   *  does not still does. */
  run(stated: DriverWorkingSet, air: AirState): DriverWorkingSet {
    const working: DriverWorkingSet = {...stated, ...airQuantities(air)};
    let changed = true;
    for (let pass = 0; changed && pass < MAX_PASSES; pass++) {
      changed = false;
      for (const route of this.routes) {
        const value = route.value(working);
        if (value === null) continue;
        if (route.keepsNonPositive || (isFinite(value) && value > 0)) {
          working[route.target] = value;
          changed = true;
        }
      }
    }
    return working;
  }

  /** Each target `solved` still lacks that some route could derive but for c and rho alone: the
   *  route's inputs, and which of them are the air. A route short of anything else is not here. */
  blockedOnAir(solved: DriverWorkingSet): readonly AirBlockedRoute[] {
    const blocked: AirBlockedRoute[] = [];
    for (const route of this.routes) {
      if (solved[route.target] != null) continue;
      const missing = route.inputs.filter(input => solved[input] == null);
      if (missing.length > 0 && missing.every(isAirName)) {
        blocked.push({target: route.target, inputs: route.inputs, missing});
      }
    }
    return blocked;
  }
}

/** A route that would derive `target` if c and rho were there. */
export interface AirBlockedRoute {
  readonly target: RouteQuantity;
  readonly inputs: readonly RouteQuantity[];
  readonly missing: readonly AirWorkingName[];
}

function isAirName(name: RouteQuantity): name is AirWorkingName {
  return AIR_WORKING_NAMES.some(air => air === name);
}

/** c and rho as the routes read them: the air's own, or absent. */
function airQuantities(air: AirState): Pick<DriverWorkingSet, AirWorkingName> {
  switch (air.kind) {
    case 'available': return {c_m_per_s: air.air.c(), roo_kg_per_m3: air.air.rho()};
    case 'notAvailable': return {c_m_per_s: undefined, roo_kg_per_m3: undefined};
  }
}
