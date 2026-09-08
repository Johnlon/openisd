// THE ENGINE'S ENTIRE PUBLIC SURFACE.
//
// One class, and the types its own method signatures name. Nothing else — no loose functions, no
// constants, no lookup tables (John Lonergan, 2026-08-27: "you will export from engine nothing
// but a single class Engine and the things that are required to be public on its api so that the
// production code works (tests are not an exception)").
//
// A calculation the system needs and `Engine` does not offer shows up as a MISSING METHOD. That
// is the whole point of the class: with loose functions it shows up as nothing, and the formula
// gets written inline in the caller instead.
//
// THE TYPES BELOW ARE NOT A SECOND SURFACE. Each one appears in an `Engine` method signature, so
// a caller cannot use the class without being able to name it. A type that stops appearing in a
// signature comes off this list.
export { Engine } from './Engine.js';
// A VALUE, not just a type: `LossMode` is a class whose static members ARE the modes
// (`LossMode.WinisdLossy`, `LossMode.Default`), so a caller cannot pass one without it.
export { LossMode } from './lossMode.js';
export type { SealedParams } from './lossMode.js';
export type { Air, AirEnvironment, AirConstantProvider } from './air.js';
export type { ConsistencyIssue } from './consistency.js';
export type {
  BoxType, SimulatableBoxType, DriverError, Filter, FilterType, MaxCurvesResult, Wiring,
  EnclosureParams, Result, SweepParams, SweepResult,
} from './types.js';
// What the solver is GIVEN and what it RETURNS, which are one shape. A TYPE export: nothing
// constructs a `SolverQuantities` — a caller writes an object literal and the solver hands one
// back — so exporting the class as a VALUE would put a constructor on the engine's surface that
// no consumer has ever called. The quantity-name list stays inside the engine: it exists for the
// two internal loops, not for consumers.
export type { SolverQuantities } from './solverQuantities.js';
