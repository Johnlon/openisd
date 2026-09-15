import { Engine } from '@openisd/design/engine';
import type { Air, DriverSolverQuantities, PrSolverQuantities, VentSolverQuantities } from '@openisd/design/engine';

export type TestSolverQuantities = DriverSolverQuantities;

const engine = new Engine();

export function solveConsistencyGroup(d: DriverSolverQuantities): DriverSolverQuantities {
    return engine.solveConsistencyGroup(d);
}

/** `air` defaults to the reference condition — every EXISTING test fixture using this helper
 *  predates air being a parameter at all, so preserving that default here (test-only) keeps
 *  every one of them unchanged; a test specifically proving air-sensitivity passes its own. */
export function solvePrConsistencyGroup(d: PrSolverQuantities, air: Air = engine.airFor({})): PrSolverQuantities {
    return engine.solvePrConsistencyGroup(d, air);
}

export function solveVentConsistencyGroup(d: VentSolverQuantities, air: Air = engine.airFor({})): VentSolverQuantities {
    return engine.solveVentConsistencyGroup(d, air);
}
