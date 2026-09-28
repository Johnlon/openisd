/**
 * The Engine provides all calculations used by the system.
 * The surface of the engine is the set of methods needed by the project.
 */

import {LossMode} from '../fields/lossMode.js';
import type {Air, AirEnvironment, EnvironmentSolveResult} from './air.js';
import {solveEnvironment} from './air.js';
import {
  closestSealedAlignment,
  ebp,
  ebpSuitability,
  findImpedancePeak,
  sealedAlignmentOptions,
  sealedFromQtc,
  sealedQtcFromVolume,
  ventedAlignment,
} from './boxDesign.js';
import {driveVoltage} from './formulas.js';
import {chartsFor as chartIdsFor, DEFAULT_BOX_TYPE, DEFAULT_CHART} from './charts.js';
import type {ChartId} from './charts.js';
import {defaultAppSettings} from './appSettings.js';
import type {AppSettings, EnvDefaults} from './appSettings.js';
import {
  nonPhysicalQuantity, quantityOutOfBand,
  ventedPlausibility, ventedTuningPlausibility, ventedVolumePlausibility,
} from './plausibility.js';
import type {VentedDesignQuantity, VentedPlausibilityIssue} from './plausibility.js';
import type {DriverIssue} from './solvers/solveDriver.js';
import {solveDriver} from './solvers/solveDriver.js';
import type {SealedAlignmentIssue} from './solvers/solveSealedAlignment.js';
import {solveSealedAlignment} from './solvers/solveSealedAlignment.js';
import {terminalBL_Tm, terminalRe_ohm} from './solvers/driverQuantities.js';
import type {
  CalculationIssue, InvalidValueIssue, NegativeValueIssue, OutOfRangeIssue, SolveRoute,
  TargetUnreachableIssue,
} from './consistency.js';
import {
  inconsistentInputs, issueFormula, missingDependencies, nonNegativeValueIssue,
  outOfRange, positiveValueIssue, targetUnreachable,
} from './consistency.js';
import {isPhysicallyPlausible} from './physicalRange.js';
import {referenceEfficiency, splFromEfficiency} from './efficiency.js';
import type {SignalIssue} from './signal.js';
import {solveSignal} from './signal.js';
import type {SealedParams} from './lossMode.js';
import {sealedResonance, sourceLoadedQts} from './lossMode.js';
import type {BoxParamsSolveResult} from './params.js';
import {solveBoxParams} from './params.js';
import {FilterEngineImpl} from './filters/index.js';
import type {PrEngine} from './pr/PrEngine.js';
import {PrEngineImpl} from './pr/PrEngine.js';
import type {VentEngine} from './vent/VentEngine.js';
import {VentEngineImpl} from './vent/VentEngine.js';
import type {FilterEngine} from './filters/index.js';
import type {MaxCurvesSolveResult, SweepSolveResult} from './sweep.js';
import {
  classifyFinite,
  classifyFiniteIssues,
  classifyFlatClamp,
  classifyMaxFinite,
  maxCurves,
  passbandRef,
  rolloffFreq,
  sweep,
} from './sweep.js';

import type {
  BoxType,
  DriverError,
  EbpSuitability,
  EnclosureParams,
  MaxCurvesResult,
  SealedAlignmentOption,
  SimulatableBoxType,
  SweepParams,
  SweepResult,
  VentedAlignment,
  VentedDesign,
  Wiring,
} from './types.js';
import {simulatableBoxType as narrowBoxType} from './types.js';
import type {DriverSolverParams, SealedAlignmentSolverParams, SignalSolverParams} from './solverTypes.js';

export class Engine {
  /** The application's own settings, read at CALL time — see `AppSettings`. Defaulted, so every
   *  existing `new Engine()` still answers with the factory values; the composition root hands
   *  the running app the stored settings instead. */
  readonly #settings: AppSettings;

  constructor(settings: AppSettings = defaultAppSettings) {
    this.#settings = settings;
  }

  // ── AIR ───────────────────────────────────────────────────────────────────────────────────

  /** The one environment call to reach for: the resolved `{ rho, c }` and any issue its stated
   *  conditions carry — one `{ values, issues }` bundle (C5). Replaces separately calling
   *  `airFor` and `environmentIssues`, which could be handed different arguments and so describe
   *  two different environments. */
  solveEnvironment(env: AirEnvironment): EnvironmentSolveResult {
    return solveEnvironment(env);
  }

  // ── THE DRIVER ────────────────────────────────────────────────────────────────────────────

  /** Re as the amplifier sees it: N coils of resistance r are r/N in parallel, N·r in series.
   *  A separate answer from `Re_ohm`, never a replacement for it. */
  terminalRe_ohm(Re_ohm: number, numVC: number | undefined, wiring: Wiring | undefined): number {
    return terminalRe_ohm(Re_ohm, numVC, wiring);
  }

  /** BL as the amplifier sees it — `bl` per coil, `N·bl` in series, unchanged in parallel. */
  terminalBL_Tm(BL_Tm: number, numVC: number | undefined, wiring: Wiring | undefined): number {
    return terminalBL_Tm(BL_Tm, numVC, wiring);
  }

  // ── CONSISTENCY GROUP SOLVERS ──────────────────────────────────────────────────────────────

  /** The one driver call to reach for (T10/T11): every entered T/S value's own handle, read
   *  into a private working set, solved and checked by the engine's own internal consistency
   *  group, with every derived value written back onto its handle via `setCalculated` (or
   *  `setNotAvailable`). Entered values — including `wiring` — are never overwritten. `air` is
   *  the project's own resolved `{ rho, c }`; a not-entered `c_m_per_s`/`roo_kg_per_m3` defaults
   *  to it and writes back as `'C'`. */
  solveDriver(params: DriverSolverParams, air: Air): DriverIssue[] {
    return solveDriver(params, air);
  }



  /** The one sealed-alignment call to reach for (T10/T11): whichever of target-`Qtc`/`Vb_m3`
   *  is not entered is derived from the driver's own `Qts`/`Vas_m3` and written onto its
   *  `SolverField` handle, and the issues follow right back. Entered values are never
   *  overwritten. */
  solveSealedAlignment(params: SealedAlignmentSolverParams): SealedAlignmentIssue[] {
    return solveSealedAlignment(params);
  }

  /** Efficiency bandwidth product — Fs/Qes, the sealed-vs-vented indicator. */
  ebp(Fs_hz: number, Qes: number): number {
    return ebp(Fs_hz, Qes);
  }

  /**
   * Reference efficiency, in the stated air.
   *
   * Takes `Air` — the DERIVED pair — rather than an `AirEnvironment`, because a driver record
   * can state its own ρ and c directly (`.wdr` allows arbitrary values), and no
   * temperature/humidity/pressure triple reproduces an arbitrary pair. A caller holding an
   * environment calls `airFor()` first; a caller holding a driver's stated pair passes it.
   */
  referenceEfficiency(Fs: number, Vas: number, Qes: number, air: Air): number {
    return referenceEfficiency(Fs, Vas, Qes, air.c);
  }

  /** SPL for a given efficiency, in the stated air. Takes `Air` for the same reason as
   *  `referenceEfficiency`. */
  splFromEfficiency(no: number, air: Air): number {
    return splFromEfficiency(no, air.rho, air.c);
  }

  /** Qts as the amplifier's source impedance loads it. Takes and returns exactly what the
   *  underlying function does. */
  sourceLoadedQts(...args: Parameters<typeof sourceLoadedQts>): ReturnType<typeof sourceLoadedQts> {
    return sourceLoadedQts(...args);
  }

  /** The voltage that delivers `pin` watts into `re` (+ `rs`) ohms. */
  driveVoltage(pin: number, re: number, rs?: number): number {
    return driveVoltage(pin, re, rs);
  }

  /** With a usable Re: an entered V writes P = V²/Re as calculated, otherwise P writes
   *  V = √(P·Re) as calculated. Without Re: P not available, with the issue naming Re. */
  solveSignal(p: SignalSolverParams): readonly SignalIssue[] {
    return solveSignal(p);
  }

  /** The formula text for one issue — the single formula for `inconsistent-inputs`, or every
   *  blocked route's formula joined for `missing-dependencies`. */
  issueFormula<Q extends string>(issue: CalculationIssue<Q>): string {
    return issueFormula(issue);
  }

  /** Whether a single RAW value would sit inside `PHYSICAL_RANGE`'s band for `field` (D9 tier 1)
   *  — the domain layer's one door into that table, since nothing outside the engine may import
   *  `physicalRange.ts` directly. */
  isPhysicallyPlausible(field: string, value: number): boolean {
    return isPhysicallyPlausible(field, value);
  }

  // ── THE BOX ───────────────────────────────────────────────────────────────────────────────

  /** Sealed resonance and Qtc under a chosen loss model. Takes `Vas` directly. */
  sealedResonance(mode: LossMode, p: SealedParams): { Fsc: number; Qtc: number } {
    return sealedResonance(mode, p);
  }

  // ── CONSTRUCTING A DQ ISSUE ───────────────────────────────────────────────────────────────
  //
  // Each of these builds one `DqIssue` with its own sentence already in it, so a caller holding
  // the issue can say what is wrong without an engine. They sit here for the same reason
  // `positiveValueIssue` does: the engine has one door, and a caller outside it constructs an
  // issue by asking the engine for one.

  /** A target no route can reach yet, naming every blocked route and what it still needs. */
  missingDependencies<Q extends string>(target: Q, routes: readonly SolveRoute<Q>[]): CalculationIssue<Q> {
    return missingDependencies(target, routes);
  }

  /** Stated values that contradict the formula relating them — every field in the group is marked. */
  inconsistentInputs<Q extends string>(
    target: Q, fields: readonly Q[], formula: string, expected: number, actual: number,
    relative: number,
  ): CalculationIssue<Q> {
    return inconsistentInputs(target, fields, formula, expected, actual, relative);
  }

  /** A driver field outside its physically possible band (D14). */
  outOfRange(field: string, value: number, limit: number, side: 'below' | 'above'): OutOfRangeIssue {
    return outOfRange(field, value, limit, side);
  }

  /** A stated target past the maximum this geometry can produce. */
  targetUnreachable(target: string, maxReachable_hz: number): TargetUnreachableIssue {
    return targetUnreachable(target, maxReachable_hz);
  }

  /** A vented-alignment quantity that is zero, negative or not finite. */
  nonPhysicalQuantity(quantity: VentedDesignQuantity, value: number): VentedPlausibilityIssue {
    return nonPhysicalQuantity(quantity, value);
  }

  /** A vented-alignment quantity outside the design band the user owns in Settings. */
  quantityOutOfBand(
    quantity: VentedDesignQuantity, value: number, min: number, max: number,
  ): VentedPlausibilityIssue {
    return quantityOutOfBand(quantity, value, min, max);
  }

  /** The one floor every positive physical quantity shares: zero, negative or non-finite is not
   *  physical, whatever field it is — every box type's volume field (sealed, bandpass 4th/6th
   *  rear+front, ABC, passive radiator — BUG_20260927_box-volume-validity-decided-in-ui.md) AND
   *  every driver spec field (BUG_20260927_driver-bad-value-decided-in-ui.md) share this ONE
   *  method, not two near-duplicates. Vented's own volume additionally judges a plausible design
   *  band on top of this floor — see `ventedVolumeIssue`, which is not this. */
  positiveValueIssue(value: number): InvalidValueIssue | null {
    return positiveValueIssue(value);
  }

  /** The weaker floor some driver fields carry instead: negative or non-finite is not physical,
   *  but zero is a legitimate stated value (BUG_20260927_driver-bad-value-decided-in-ui.md).
   *  Which floor applies to which field is the field's own `NumberField.floor`, not this
   *  method's business. */
  nonNegativeValueIssue(value: number): NegativeValueIssue | null {
    return nonNegativeValueIssue(value);
  }

  /**
   * Sealed-chamber resonance from the driver's STORED values, in the stated air.
   *
   * The domain stores compliance and cone area, never `Vas` — Vas is derived, and deriving it
   * needs air, which is the engine's business. So a caller that holds a driver record passes
   * what it has and this works out the rest.
   *
   * Null when the volume is not positive — absence is `null` in this system, never NaN or 0.
   */
  sealedResonanceFromCompliance(
    mode: LossMode,
    input: {
      Fs_hz: number; Qts: number; Sd_m2: number; Cms_m_per_N: number;
      volume_m3: number; Ql: number; Qa: number;
    },
    air: Air,
  ): number | null {
    if (!(input.volume_m3 > 0)) return null;
    const Vas = input.Cms_m_per_N * input.Sd_m2 ** 2 * air.rho * air.c ** 2;
    return sealedResonance(mode, {
      Fs: input.Fs_hz, Qts: input.Qts, Vas, Vb: input.volume_m3, Ql: input.Ql, Qa: input.Qa,
    }).Fsc;
  }


  /** The chamber volume that reaches a target system Q — the alignment picker's solve. */
  sealedFromQtc(Qts: number, Vas_m3: number, Qtc: number): number | null {
    return sealedFromQtc(Qts, Vas_m3, Qtc);
  }

  sealedAlignmentOptions(): readonly SealedAlignmentOption[] {
    return sealedAlignmentOptions();
  }

  sealedQtcFromVolume(Qts: number, Vas_m3: number, Vb_m3: number): number | null {
    return sealedQtcFromVolume(Qts, Vas_m3, Vb_m3);
  }

  closestSealedAlignment(Qtc: number): SealedAlignmentOption {
    return closestSealedAlignment(Qtc);
  }

  ebpSuitability(EBP_hz: number): EbpSuitability {
    return ebpSuitability(EBP_hz);
  }

  /** WinISD's five wizard vented alignments, bit-for-bit (`boxDesign.ts#ventedAlignment`).
   *  `QtsLoaded` is `sourceLoadedQts()`'s answer, not the bare driver Qts; `Ql` is read by
   *  BB4/SBB4 only. */
  ventedAlignment(alignment: VentedAlignment, Fs_hz: number, QtsLoaded: number, Vas_m3: number, Ql: number): VentedDesign {
    return ventedAlignment(alignment, Fs_hz, QtsLoaded, Vas_m3, Ql);
  }

  /** Which of a designed vented box's two answers a person should not trust — outside the
   *  alignment's design range WinISD extrapolates, `ventedAlignment()` matches it, and this is
   *  what marks the result instead of changing it. Judged against THIS engine's `AppSettings`,
   *  read now, so a Settings edit lands without anything being rebuilt. */
  ventedPlausibility(design: VentedDesign): readonly VentedPlausibilityIssue[] {
    return ventedPlausibility(design, this.#settings.ventedLimits());
  }

  /** A designed box volume alone. A project CELL holds one quantity, so it can only be marked
   *  for that quantity's own issue; `ventedPlausibility` answers for the wizard readout, which
   *  shows both at once. */
  ventedVolumeIssue(Vb_m3: number): VentedPlausibilityIssue | null {
    return ventedVolumePlausibility(Vb_m3, this.#settings.ventedLimits());
  }

  /** A designed tuning alone — `ventedVolumeIssue`'s counterpart. */
  ventedTuningIssue(Fb_hz: number): VentedPlausibilityIssue | null {
    return ventedTuningPlausibility(Fb_hz, this.#settings.ventedLimits());
  }

  /** The app's configured environment defaults (Options → Environment), or the reference
   *  values when nothing has been configured — see `AppSettings.envDefaults()`. */
  envDefaults(): EnvDefaults {
    return this.#settings.envDefaults();
  }

  /** Sealed resonance and Qtc read off a swept impedance curve, rather than computed. */
  findImpedancePeak(result: SweepResult | null, Re: number): { Fsc: number; Qtc: number } | null {
    return findImpedancePeak(result, Re);
  }

  /** Which of this engine's topologies a box type is, or null when it has no circuit for it —
   *  the caller's cue to report a design it cannot simulate rather than draw a wrong curve. */
  simulatableBoxType(box: BoxType): SimulatableBoxType | null {
    return narrowBoxType(box);
  }

  /** The charts a project with this box type shows, in WinISD's own chart-menu order — port
   *  charts only for a ported box, PR charts only for a radiator, the ten system charts and the
   *  three EQ/filter charts always (bugs/BUG_20260927_winisd-charts-missing.md). A design
   *  decision, not a UI one — the UI shows exactly the ids this returns. */
  chartsFor(box: BoxType): readonly ChartId[] {
    return chartIdsFor(box);
  }

  /** The chart a fresh project, or an invalid/inapplicable remembered chart id, falls back to —
   *  a design decision, not a UI literal. */
  get defaultChart(): ChartId {
    return DEFAULT_CHART;
  }

  /** The box type the chart menu (and any other box-shaped display) assumes when no project is
   *  focused at all. */
  get defaultBoxType(): BoxType {
    return DEFAULT_BOX_TYPE;
  }

  // ── THE PASSIVE RADIATOR ──────────────────────────────────────────────────────────────────

  /** The passive-radiator area — its own Vas/Fs/Qms and inverses, system tuning, mass for a
   *  tuning, and the handle solve. */
  readonly pr: PrEngine = new PrEngineImpl();

  // ── THE BOX: vents ────────────────────────────────────────────────────────────────────────

  /** The vent area — port length for a tuning, tuning for a length, acoustic length, and the
   *  handle solve. */
  readonly vent: VentEngine = new VentEngineImpl();

  // ── FILTERS ──────────────────────────────────────────────────────────────────────────────

  /** The filters area — defaults, captions, `.wpr` in and out, and the typed edits an editor
   *  may make. One member, not twelve forwarding methods. */
  readonly filters: FilterEngine = new FilterEngineImpl();

  // ── THE SWEEP ─────────────────────────────────────────────────────────────────────────────

  /** The response, one complex value per frequency. */
  sweep(drv: DriverSolverParams, Le_H: number | undefined, box: BoxType, P: SweepParams): SweepSolveResult {
    return sweep(drv, Le_H, box, P);
  }

  /** The limit curves — how loud before excursion or port velocity gives out. */
  maxCurves(drv: DriverSolverParams, Le_H: number | undefined, box: BoxType, P: SweepParams): MaxCurvesSolveResult {
    return maxCurves(drv, Le_H, box, P);
  }

  /** The one enclosure-parameter call to reach for (T9): `values` is `P` unchanged when every
   *  field the circuit divides by is present for `box`'s topology, else `null`, with `issues`
   *  naming what is missing. A topology the circuit has no model for reports `{values: null,
   *  issues: []}` — naming the enclosure itself is the store's presentation concern (S3). */
  solveBoxParams(box: BoxType, P: EnclosureParams): BoxParamsSolveResult {
    return solveBoxParams(box, P);
  }

  /** The passband reference level a response is measured against. */
  passbandRef(spl: number[]): number {
    return passbandRef(spl);
  }

  /** Where the response has fallen by `dropDb`, or null if it never does. */
  rolloffFreq(sw: SweepResult, dropDb: number): number | null {
    return rolloffFreq(sw, dropDb);
  }

  /** A response carrying a non-finite value — a fault, not a curve. */
  classifyFinite(sw: SweepResult): DriverError | null {
    return classifyFinite(sw);
  }

  /** Finiteness issues split by plotted output, for a chart that needs one specific cause. */
  classifyFiniteIssues(sw: SweepResult): DriverError[] {
    return classifyFiniteIssues(sw);
  }

  /** A response the flat-clamp produced rather than the physics. */
  classifyFlatClamp(sw: SweepResult): DriverError | null {
    return classifyFlatClamp(sw);
  }

  /** Limit curves carrying a non-finite value. */
  classifyMaxFinite(mx: MaxCurvesResult): DriverError | null {
    return classifyMaxFinite(mx);
  }
}
