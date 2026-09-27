import type { SolverField } from '../../engine/index.js';

/**
 * A `SolverField` for a `DriverSolverParams` quantity the domain has no storage slot for
 * (`SPLref_dB`, `Re_terminal_ohm`, `BL_terminal_Tm` — none of the three ever appeared in the
 * bag `solvedNow()` built either, before S2-7c; this carries the same gap forward honestly
 * rather than inventing storage for it here). Always not-available; any write is silently
 * discarded — frozen and shared, since it holds no per-call state. */
export const NO_SLOT: SolverField = Object.freeze({
    value: null,
    entered: false,
    calculated: false,
    precision: null,
    dq: Object.freeze([]),
    setCalculated: () => {},
    setDq: () => {},
    setNotAvailable: () => {},
});
