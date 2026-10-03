import {DEFAULT_P_REF_PA, GAMMA, solveEnvironment} from '../../air.js';
import type {DriverWorkingSet} from '../../solvers/driverQuantities.js';

/**
 * The air a driver record carries, read off its working set each time. Matches WinISD's own
 * resolution rule (`docs/design/WINISD_SCHEMA.md` §12): never a stored constant.
 */
export class DriverAir {
  /** The record's stated `c`; else recomputed from its stated `roo` via `c = √(γ·p/roo)`; else the
   *  live physical model at the reference environment. */
  c(r: Readonly<DriverWorkingSet>): number {
    if (r.c_m_per_s != null && r.c_m_per_s > 0) return r.c_m_per_s;
    if (r.roo_kg_per_m3 != null && r.roo_kg_per_m3 > 0) return Math.sqrt(GAMMA * DEFAULT_P_REF_PA / r.roo_kg_per_m3);
    return solveEnvironment({}).values.c;
  }

  /** The record's stated `roo`, else the live physical model at the reference environment. WinISD
   *  never recomputes a missing `roo` from `c`. */
  rho(r: Readonly<DriverWorkingSet>): number {
    return r.roo_kg_per_m3 != null && r.roo_kg_per_m3 > 0 ? r.roo_kg_per_m3 : solveEnvironment({}).values.rho;
  }
}
