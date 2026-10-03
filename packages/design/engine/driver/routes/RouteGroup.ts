import type {DriverWorkingSet} from '../../solvers/driverQuantities.js';
import type {DriverAir} from './DriverAir.js';
import type {DriverRoute} from './SolveRoute.js';

const MAX_PASSES = 10;

/**
 * An ordered list of routes run to a fixed point. In each pass every route in turn gives its value
 * against the working set as the earlier routes left it; a value is written only into a null
 * target, and only when it is finite and above zero (a rejected value leaves the target null so a
 * later route can still fill it). A quantity handed in is never overwritten.
 */
export class RouteGroup {
  constructor(
    private readonly routes: readonly DriverRoute[],
    private readonly air: DriverAir,
  ) {}

  /** `stated` plus everything the routes derive. The result is a superset of the input. */
  run(stated: DriverWorkingSet): DriverWorkingSet {
    const working: DriverWorkingSet = {...stated};
    let changed = true;
    for (let pass = 0; changed && pass < MAX_PASSES; pass++) {
      changed = false;
      for (const route of this.routes) {
        const value = route.value(working, this.air);
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
