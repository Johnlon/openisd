// Public API surface for the engine
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
export {
  DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA,
  MIN_SUPPORTED_TEMP_K, MAX_SUPPORTED_TEMP_K,
} from './air.js';
export type { Air, AirEnvironment, AirConstantProvider, EnvironmentQuantityName, EnvironmentIssue } from './air.js';
export type { CalculationIssue, SolveRoute, DqIssue, TargetUnreachableIssue, OutOfRangeIssue } from './consistency.js';
// APPLICATION SETTINGS reach a calculation through the collaborator `new Engine(settings)`
// takes, never a module constant read behind the caller's back. The factory band crosses as a
// VALUE for the same reason the air reference constants do: the Settings tab has to show the
// user what their setting starts at, and what Reset puts back.
export { DEFAULT_VENTED_DESIGN_LIMITS, DEFAULT_ENV_DEFAULTS } from './appSettings.js';
export type { AppSettings, EnvDefaults } from './appSettings.js';
export type { VentedDesignLimits, VentedDesignQuantity, VentedPlausibilityIssue } from './plausibility.js';
export type { SweepOutputName, CalculationPrerequisite } from './consistency.js';
export type {
  BoxType, SimulatableBoxType, DriverError, EbpSuitability, Filter, FilterType, MaxCurvesResult,
  SealedAlignmentOption, VentedAlignment, VentedDesign, Wiring,
  EnclosureParams, SweepParams, SweepResult,
} from './types.js';
export type { BoxParamsQuantityName, BoxParamsIssue, BoxParamsSolveResult } from './params.js';
export type { SignalQuantityName, SignalIssue } from './signal.js';
export type { SweepIssue, SweepSolveResult, MaxCurvesSolveResult } from './sweep.js';
export type {
  DriverQuantityName, DriverIssue, DriverPrerequisite,
  VentQuantityName, VentIssue, PrQuantityName, PrIssue, SealedAlignmentQuantityName, SealedAlignmentIssue,
} from './solver.js';
// `SolverField` is the interface a domain field implements for the solver; `SolverInput` its
// read-only half. The domain imports these through the door, never a solverTypes subpath.
export type { SolverField, SolverInput } from './solverTypes.js';
export type { VentSolverParams } from './solverTypes.js';
export type { PrSolverParams } from './solverTypes.js';
export type { SealedAlignmentSolverParams } from './solverTypes.js';
export type { PresentSolverField, SignalSolverParams } from './solverTypes.js';
export type { DriverSolverParams } from './solverTypes.js';
