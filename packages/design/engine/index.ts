// Public API surface for the engine
// One aggregate interface, its factory, the area interfaces it holds, and the types their
// signatures name. Nothing else — no loose calculation functions, no constants, no lookup tables (John Lonergan, 2026-08-27: "you will export from engine nothing
// but a single class Engine and the things that are required to be public on its api so that the
// production code works (tests are not an exception)").
//
// A calculation the system needs and no area offers shows up as a MISSING METHOD on that area.
// That is the whole point: with loose functions it shows up as nothing, and the formula gets
// written inline in the caller instead.
//
// THE TYPES BELOW ARE NOT A SECOND SURFACE. Each one appears in an area's method signature, so
// a caller cannot use the area without being able to name it. A type that stops appearing in a
// signature comes off this list.
export type { Engine } from './Engine.js';
export { createEngine } from './Engine.js';
// The engine's areas: an interface each, held by `Engine` as a member (`engine.filters`).
export type { FilterEngine } from './filters/index.js';
export type { PassOrderEntry } from './filters/FilterEngine.js';
export type { SealedParams } from './sealedResonance.js';
export {
  DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA,
  MIN_SUPPORTED_TEMP_K, MAX_SUPPORTED_TEMP_K,
} from './air.js';
export type { Air, AirEnvironment, AirConstantProvider, EnvironmentQuantityName, EnvironmentIssue } from './air.js';
export type { CalculationIssue, SolveRoute, DqIssue, TargetUnreachableIssue, OutOfRangeIssue } from './consistency.js';
// APPLICATION SETTINGS reach a calculation through the collaborator `createEngine(settings)`
// takes, never a module constant read behind the caller's back. The factory band crosses as a
// VALUE for the same reason the air reference constants do: the Settings tab has to show the
// user what their setting starts at, and what Reset puts back.
export { DEFAULT_VENTED_DESIGN_LIMITS, DEFAULT_ENV_DEFAULTS } from './appSettings.js';
export type { AppSettings, EnvDefaults } from './appSettings.js';
export type { VentedDesignLimits, VentedDesignQuantity, VentedPlausibilityIssue } from './plausibility.js';
export type { SweepOutputName, CalculationPrerequisite } from './consistency.js';
export type {
  BoxType, SimulatableBoxType, DriverError, EbpSuitability, Filter, FilterSpec, FilterType,
  PassFamily, MaxCurvesResult,
  // Each filter class's chain filter and editor patch — named once, in `FilterEngine.editX`'s
  // signature and its editor's props alike.
  PassFilter, PassPatch, AllpassFilter, AllpassPatch, LinkwitzFilter, LinkwitzPatch,
  ParametricEqFilter, ParametricEqPatch, PeakHighpassFilter, PeakHighpassPatch,
  StaticGainFilter, StaticGainPatch, RaisedCosineFilter, RaisedCosinePatch, ShelfFilter, ShelfPatch,
  SealedAlignmentOption, VentedAlignment, VentedDesign, Wiring,
  EnclosureParams, PrParams, SweepParams, SweepResult, WprFilter, WprFilterImport,
} from './types.js';
export type { BoxEngine, ChartId } from './box/BoxEngine.js';
export type { BoxParamsQuantityName, BoxParamsIssue, BoxParamsSolveResult } from './params.js';
export type { SignalEngine, SignalQuantityName, SignalIssue } from './signal/SignalEngine.js';
export type { SimulationEngine, SweepIssue, SweepSolveResult, MaxCurvesSolveResult } from './simulation/SimulationEngine.js';
export type {DriverEngine, DriverQuantityName, DriverIssue, DriverPrerequisite} from './driver/DriverEngine.js';
export type {EnvironmentEngine} from './environment/EnvironmentEngine.js';
export type {IssueEngine} from './issues/IssueEngine.js';
export type {VentEngine, VentQuantityName, VentIssue} from './vent/VentEngine.js';
export type {PrEngine, PrQuantityName, PrIssue, PrSpecIssue, PrSpecPrecision, PrSpecValues} from './pr/PrEngine.js';
export type {VentedEngine} from './vented/VentedEngine.js';
export type {SealedEngine, SealedAlignmentQuantityName, SealedAlignmentIssue} from './sealed/SealedEngine.js';
// `SolverField` is the interface a domain field implements for the solver; `SolverInput` its
// read-only half. The domain imports these through the door, never a solverTypes subpath.
export type { SolverField, SolverInput } from './solverTypes.js';
export type { VentSolverParams } from './solverTypes.js';
export type { PrSolverParams } from './solverTypes.js';
export type { SealedAlignmentSolverParams } from './solverTypes.js';
export type { PresentSolverField, SignalSolverParams } from './solverTypes.js';
export type { DriverSolverParams, DriverValues, SweepDriver } from './solverTypes.js';
