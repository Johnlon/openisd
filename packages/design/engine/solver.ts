// Re-export shim ONLY. The solve functions and their working-set types moved to
// `packages/design/engine/solvers/` (one file per solver, plus a shared driverQuantities module
// for the WIRING-facing helpers every solve reads) — see that folder's own files for the real
// code and doc comments.
//
// Kept here, rather than deleted, purely because `sweep.ts` imports from `./solver.js` and a
// parallel worker is editing `sweep.ts`/`charts.ts`/`series.ts` in a different worktree at the
// same time this split was done — updating its import statement was out of scope for this split.
// Once that lands, `sweep.ts` can be repointed at `./solvers/...` directly and this file deleted.
export type {DriverIssue, DriverPrerequisite, DriverQuantityName} from './solvers/solveDriver.js';
export type {VentIssue} from './solvers/solveVent.js';
export type {PrIssue} from './solvers/solvePr.js';
export {terminalBL_Tm, withAddedMass} from './solvers/driverQuantities.js';
