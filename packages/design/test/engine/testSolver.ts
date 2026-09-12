import { Engine } from '@openisd/design/engine';
import type { DriverSolverQuantities, PrSolverQuantities, VentSolverQuantities } from '@openisd/design/engine';

export type TestSolverQuantities = DriverSolverQuantities;

const engine = new Engine();

export function solveConsistencyGroup(d: DriverSolverQuantities): DriverSolverQuantities {
    return engine.solveConsistencyGroup(d);
}

export function solvePrConsistencyGroup(d: PrSolverQuantities): PrSolverQuantities {
    return engine.solvePrConsistencyGroup(d);
}

export function solveVentConsistencyGroup(d: VentSolverQuantities): VentSolverQuantities {
    return engine.solveVentConsistencyGroup(d);
}
