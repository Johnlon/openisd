import { Engine } from '@openisd/design/engine';
import type { Air, DriverSolverQuantities, PrSolverQuantities, VentSolverQuantities } from '@openisd/design/engine';
import type { SolverField } from '@openisd/design/engine';

export type TestSolverQuantities = DriverSolverQuantities;

const engine = new Engine();

/** A test seam for the engine's `SolverField` handle contracts (T10): the value is "entered"
 *  when seeded, and records whatever the solve writes (`calculated`/`not-available`). */
export function fakeSolverField(value: number | null): SolverField {
  let current: number | null = value;
  let state: 'entered' | 'calculated' | 'not-available' = value === null ? 'not-available' : 'entered';
  return {
    get value() { return current; },
    get entered() { return state === 'entered'; },
    get calculated() { return state === 'calculated'; },
    get notAvailable() { return state === 'not-available'; },
    get dq() { return [] as string[]; },
    setCalculated(v: number) { current = v; state = 'calculated'; },
    setDq() {},
    setNotAvailable() { current = null; state = 'not-available'; },
  };
}

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
