import type { SolverField } from '../../engine/index.js';

const discardWrite = (): void => {};

/** A `SolverField` reporting a freshly COMPUTED value with no storage behind it — sibling to
 *  `NO_SLOT`, but for a quantity `sweep()` genuinely needs a real number for (the terminal
 *  Re/BL), unlike `SPLref_dB`, which stays permanently not-available. Any write is silently
 *  discarded: nothing persists a value neither `solveDriver()`'s own resolve nor the domain has
 *  a slot for (S2-10) — `OpenIsdDriverSpec.solverParams()` recomputes it fresh on every call, the same
 *  as the bag `solveConsistencyGroup()` used to. */
export function computedSlot<T>(value: T | null): SolverField<T> {
    return {
        value, entered: false, calculated: value != null, precision: null,
        dq: [],
        setCalculated: discardWrite, setDq: discardWrite, setNotAvailable: discardWrite,
    };
}
