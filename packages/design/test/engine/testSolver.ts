import { solveDriverConsistencyGroup as engineSolve, solvePrConsistencyGroup as prSolve, solveVentConsistencyGroup as ventSolve } from '../../engine/solver.js';
import type { DriverSolverQuantities, PrSolverQuantities, VentSolverQuantities } from '../../engine/solverQuantities.js';

export type TestSolverQuantities = DriverSolverQuantities;

export function solveConsistencyGroup(d: DriverSolverQuantities): DriverSolverQuantities {
    return engineSolve(d);
}

export function solvePrConsistencyGroup(d: PrSolverQuantities): PrSolverQuantities {
    return prSolve(d);
}

export function solveVentConsistencyGroup(d: VentSolverQuantities): VentSolverQuantities {
    return ventSolve(d);
}
