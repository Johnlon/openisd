import type {DriverWorkingSet} from '../../solvers/driverQuantities.js';
import type {Air, AirWorkingName} from '../../air.js';
import type {DriverRoute} from './SolveRoute.js';

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
   *  2026-10-05: a driver record's own c and roo feed no calculation). */
  run(stated: DriverWorkingSet, air: Air): DriverWorkingSet {
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
}

/** c and rho as the routes read them: the air's own. */
function airQuantities(air: Air): Pick<DriverWorkingSet, AirWorkingName> {
  return {c_m_per_s: air.c(), roo_kg_per_m3: air.rho()};
}
