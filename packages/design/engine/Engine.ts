/**
 * The Engine provides all calculations used by the system.
 * The surface of the engine is the set of methods needed by the project.
 */

import type {Air, AirEnvironment, EnvironmentSolveResult} from './air.js';
import {solveEnvironment} from './air.js';
import {
  closestSealedAlignment,
  ebp,
  ebpSuitability,
  findImpedancePeak,
  prMassForFp,
  prTuning,
  sealedAlignmentOptions,
  sealedFromQtc,
  sealedQtcFromVolume,
  tuningFromLength,
  ventLength,
} from './boxDesign.js';
import {
  driveFromVoltage,
  driveVoltage,
  prCmsFromVas,
  prFsWithMass,
  prMmdFromFs,
  prQms,
  prRmsFromQms,
  prVas,
} from './formulas.js';
import type {DriverIssue, PrIssue, SealedAlignmentIssue, VentIssue} from './solver.js';
import {solveDriver, solvePr, solveSealedAlignment, solveVent, terminalBL_Tm, terminalRe_ohm,} from './solver.js';
import type {CalculationIssue} from './consistency.js';
import {issueFields, issueFormula, issueToText} from './consistency.js';
import {referenceEfficiency, splFromEfficiency} from './efficiency.js';
import type {SignalSolveResult, SignalSolverQuantities} from './signal.js';
import {solveSignal} from './signal.js';
import type {LossMode, SealedParams} from './lossMode.js';
import {sealedResonance, sourceLoadedQts} from './lossMode.js';
import type {BoxParamsSolveResult} from './params.js';
import {solveBoxParams} from './params.js';
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
  Wiring
} from './types.js';
import {simulatableBoxType as narrowBoxType} from './types.js';
import type {DriverSolverParams, PrSolverParams, SealedAlignmentSolverParams, VentSolverParams} from './solverTypes.js';

export class Engine {
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

  /** The one radiator call to reach for (T10/T11): whichever of tuning/added-mass is not
   *  entered is derived and written onto its `SolverField` handle, and the issues follow right
   *  back. `air` is the project's own resolved `{ rho, c }` — see `boxDesign.ts#ventLength`'s
   *  doc comment. Entered values are never overwritten. */
  solvePr(params: PrSolverParams, air: Air): PrIssue[] {
    return solvePr(params, air);
  }

  /** The one vent call to reach for (T10/T11): whichever of tuning/length is not entered is
   *  derived and written onto its `SolverField` handle, and the issues follow right back.
   *  `air` is the project's own resolved `{ rho, c }` — see `boxDesign.ts#ventLength`'s doc
   *  comment. Entered values are never overwritten. */
  solveVent(params: VentSolverParams, air: Air): VentIssue[] {
    return solveVent(params, air);
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

  /** The voltage that delivers `pin` watts into `re` ohms. */
  driveVoltage(pin: number, re: number): number {
    return driveVoltage(pin, re);
  }

  /** The reference power that `eg` volts delivers into `re` ohms — the inverse of `driveVoltage`. */
  driveFromVoltage(eg: number, re: number): number {
    return driveFromVoltage(eg, re);
  }

  /** The drive value the circuit uses, and its issues, from whatever the project states about
   *  power/voltage/Re/driver count/wiring/series resistance — the unified `{ values, issues }`
   *  shape, same discipline as `solveDriver()`. The established 1 W reference is a valid,
   *  complete input, not a missing value. */
  solveSignal(p: SignalSolverQuantities): SignalSolveResult {
    return solveSignal(p);
  }

  /** Every field one `CalculationIssue` names, whichever domain it comes from — the target,
   *  plus (for `missing-dependencies`) every field any of its routes requires or is still
   *  missing. One generic answer so a caller never re-derives "does this issue name that
   *  field" per channel. */
  issueFields<Q extends string>(issue: CalculationIssue<Q>): readonly Q[] {
    return issueFields(issue);
  }

  /** The formula text for one issue — the single formula for `inconsistent-inputs`, or every
   *  blocked route's formula joined for `missing-dependencies`. */
  issueFormula<Q extends string>(issue: CalculationIssue<Q>): string {
    return issueFormula(issue);
  }

  /** One sentence for one issue — the same text the cascade DQ, the sweep error channel and the
   *  driver editor tooltip all show, so a user reads one story regardless of where it surfaced. */
  issueToText<Q extends string>(issue: CalculationIssue<Q>): string {
    return issueToText(issue);
  }

  // ── THE BOX ───────────────────────────────────────────────────────────────────────────────

  /** Sealed resonance and Qtc under a chosen loss model. Takes `Vas` directly. */
  sealedResonance(mode: LossMode, p: SealedParams): { Fsc: number; Qtc: number } {
    return sealedResonance(mode, p);
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

  /** A passive radiator's tuning from its own mass and compliance. `air` is the project's own
   *  resolved `{ rho, c }` — see `boxDesign.ts#ventLength`'s doc comment. */
  prTuning(p: Parameters<typeof prTuning>[0], air: Air): number {
    return prTuning(p, air);
  }

  // ── THE BOX: vents ────────────────────────────────────────────────────────────────────────

  /** Port length for a target tuning, from the chamber volume, ONE port's area and the number of
   *  identical ports. `air` is the project's own resolved `{ rho, c }` — see
   *  `boxDesign.ts#ventLength`'s doc comment. */
  ventLength(Vb: number, fb: number, Sp: number, count: number, air: Air, endCorrection?: number): number {
    return ventLength(Vb, fb, Sp, count, air, endCorrection);
  }

  /** The tuning a port of that length actually produces — the inverse of `ventLength`. Both
   *  directions exist because the user may enter either, and the other is then solved. */
  tuningFromLength(Vb: number, L: number, Sp: number, count: number, air: Air, endCorrection?: number): number {
    return tuningFromLength(Vb, L, Sp, count, air, endCorrection);
  }

  /**
   * A port's ACOUSTIC length — the physical length plus the end correction, which is what the
   * sweep's port model actually resonates (`SweepParams.Leff`).
   *
   * Takes the port's AREA, not its shape, and derives the equivalent diameter from it —
   * `2·√(Sp/π)`. That is exact for a round port (`2·√(πr²/π) = 2r = d`) and is the standard
   * equivalent-diameter substitution for a slotted one, so the end correction, which is
   * inherently a round-port idea, applies to both with no branch and no shape argument.
   *
   * `count` is taken so every port call states the same geometry, but the end correction is a
   * PER-PORT effect: the answer does not change with the number of identical ports.
   */
  ventEffectiveLength(length_m: number, Sp: number, count: number, endCorrection: number): number {
    void count;
    return length_m + endCorrection * 2 * Math.sqrt(Sp / Math.PI);
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

  /** Sealed resonance and Qtc read off a swept impedance curve, rather than computed. */
  findImpedancePeak(result: SweepResult | null, Re: number): { Fsc: number; Qtc: number } | null {
    return findImpedancePeak(result, Re);
  }

  // ── THE PASSIVE RADIATOR ──────────────────────────────────────────────────────────────────

  /** Added cone mass that tunes a radiator to `fp`. `air` is the project's own resolved
   *  `{ rho, c }` — see `boxDesign.ts#ventLength`'s doc comment. */
  prMassForFp(P: Parameters<typeof prMassForFp>[0], fp: number, air: Air): number {
    return prMassForFp(P, fp, air);
  }

  /** Which of this engine's topologies a box type is, or null when it has no circuit for it —
   *  the caller's cue to report a design it cannot simulate rather than draw a wrong curve. */
  simulatableBoxType(box: BoxType): SimulatableBoxType | null {
    return narrowBoxType(box);
  }

  /** Compliance-equivalent volume, in cubic metres. */
  prVas(prCms: number, prSd: number): number { return prVas(prCms, prSd); }

  /** Compliance from Vas (cubic metres) and Sd — the inverse of `prVas`. */
  prCmsFromVas(prVas_m3: number, prSd: number): number { return prCmsFromVas(prVas_m3, prSd); }

  /** Free-air resonance loaded with added cone mass. */
  prFsWithMass(prMmd: number, prMadd: number, prCms: number): number {
    return prFsWithMass(prMmd, prMadd, prCms);
  }

  /** Moving mass from free-air Fs and compliance — the inverse of the resonance. */
  prMmdFromFs(prFsHz: number, prCms: number): number { return prMmdFromFs(prFsHz, prCms); }

  /** Mechanical Q from mass, compliance and resistance. */
  prQms(prMmd: number, prCms: number, prRms: number): number { return prQms(prMmd, prCms, prRms); }

  /** Mechanical resistance from Qms — the inverse of `prQms`. */
  prRmsFromQms(prQmsValue: number, prMmd: number, prCms: number): number {
    return prRmsFromQms(prQmsValue, prMmd, prCms);
  }

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
