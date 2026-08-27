// THE ENGINE — one instantiable class, and the only calculation surface the rest of the system
// sees.
//
// John's ruling, 2026-08-27: "I want one instantiable Engine class that provides the calcs used
// by the system - everything else becomes a private method inside the class - surface of engine
// is the few methods needed by the project".
//
// WHY A CLASS RATHER THAN THE FREE FUNCTIONS NEXT DOOR: a calculation the system wants and this
// class does not offer shows up as a MISSING METHOD. With free functions it shows up as nothing
// at all, and the formula gets written inline in the caller instead — which is exactly how
// `#sealedResonance` came to duplicate the engine's own sealed-resonance calc over frozen air
// constants (deleted 2026-08-27, the origin of the geometry-in/acoustics-out ruling).
//
// THE SURFACE IS WHAT CALLERS ACTUALLY USE, and nothing else: the 21 behaviours the old
// `packages/engine` barrel hands out today, measured from every `import ... from
// '@openisd/engine'` in the tree. It grows when a caller needs something, never in anticipation.
//
// The sibling modules in this directory are the implementation. They are being folded in as
// private methods; until that is finished these methods delegate to them.

import { airFor } from './air.js';
import type { Air, AirEnvironment } from './air.js';
import {
  ebp, prTuning, findImpedancePeak, prMassForFp, sealedFromQtc, tuningFromLength, ventLength,
} from './alignments.js';
import {
  prCmsFromVas, prFsWithMass, prMmdFromFs, prQms, prRmsFromQms, prVas,
} from './formulas.js';
import { checkConsistency, isQGroupField, qGroupIsIncomplete } from './consistency.js';
import { deriveEngineDriver, solveConsistencyGroup } from './driver.js';
import { referenceEfficiency, splFromEfficiency } from './efficiency.js';
import { driveVoltage } from './formulas.js';
import { sealedResonance, sourceLoadedQts } from './lossMode.js';
import { validateParams } from './params.js';
import {
  classifyFinite, classifyFlatClamp, classifyMaxFinite,
  maxCurves, passbandRef, rolloffFreq, sweep,
} from './sweep.js';
import type { ConsistencyIssue } from './consistency.js';
import type { EngineDriver, Result } from './types.js';
import type { BoxType, DriverError, SweepParams, SweepResult, MaxCurvesResult } from './types.js';
import type { LossMode, SealedParams } from './lossMode.js';

/** The driver's entered values, keyed by field name. Declared here rather than imported: the
 *  implementation modules keep this type local, and the class must name it in its signatures. */
type DriverFields = Record<string, number | undefined>;

export class Engine {
  // ── AIR ───────────────────────────────────────────────────────────────────────────────────

  /**
   * Density and sound speed for stated conditions.
   *
   * EVERY field of `AirEnvironment` is optional, and an absent one falls back to the reference
   * condition inside this call. So a project passes what the USER typed and nothing else: there
   * is no null to handle at the call site, and the domain never restates the reference values.
   */
  airFor(env: AirEnvironment): Air {
    return airFor(env);
  }

  // ── THE DRIVER ────────────────────────────────────────────────────────────────────────────

  /** Fill in whatever the entered driver values imply, leaving what they do not. */
  solveConsistencyGroup(d: DriverFields, options?: { full?: boolean }): DriverFields {
    return solveConsistencyGroup(d, options);
  }

  /** The driver a sweep can run on, or what is missing. */
  deriveEngineDriver(d: DriverFields): Result<EngineDriver> {
    return deriveEngineDriver(d);
  }

  /** Everything the entered values disagree about. */
  checkConsistency(entered: Parameters<typeof checkConsistency>[0]): ConsistencyIssue[] {
    return checkConsistency(entered);
  }

  /** Whether `field` is one of the interdependent Q values. */
  isQGroupField(field: string): boolean {
    return isQGroupField(field);
  }

  /** Whether too few of the Q group are stated for the rest to follow. */
  qGroupIsIncomplete(usable: (field: string) => boolean): boolean {
    return qGroupIsIncomplete(usable);
  }

  /** Efficiency bandwidth product — Fs/Qes, the sealed-vs-vented indicator. */
  ebp(drv: Pick<EngineDriver, 'Fs' | 'Qes'>): number {
    return ebp(drv);
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

  /** Qts as the amplifier's source impedance loads it. */
  sourceLoadedQts(...args: Parameters<typeof sourceLoadedQts>): ReturnType<typeof sourceLoadedQts> {
    return sourceLoadedQts(...args);
  }

  /** The voltage that delivers `pin` watts into `re` ohms. */
  driveVoltage(pin: number, re: number): number {
    return driveVoltage(pin, re);
  }

  // ── THE BOX ───────────────────────────────────────────────────────────────────────────────

  /** Sealed resonance and Qtc under a chosen loss model. */
  sealedResonance(mode: LossMode, p: SealedParams): { Fsc: number; Qtc: number } {
    return sealedResonance(mode, p);
  }

  /** A passive radiator's tuning from its own mass and compliance. */
  prTuning(p: Parameters<typeof prTuning>[0]): number {
    return prTuning(p);
  }

  // ── THE BOX: vents ────────────────────────────────────────────────────────────────────────

  /** Port length for a target tuning, from the chamber volume and the port's area. */
  ventLength(Vb: number, fb: number, Sp: number, endCorrection?: number): number {
    return ventLength(Vb, fb, Sp, endCorrection);
  }

  /** The tuning a port of that length actually produces — the inverse of `ventLength`. Both
   *  directions exist because the user may enter either, and the other is then solved. */
  tuningFromLength(Vb: number, L: number, Sp: number, endCorrection?: number): number {
    return tuningFromLength(Vb, L, Sp, endCorrection);
  }

  /** The chamber volume that reaches a target system Q — the alignment picker's solve. */
  sealedFromQtc(drv: Pick<EngineDriver, 'Qts' | 'Vas'>, Qtc: number): number | null {
    return sealedFromQtc(drv, Qtc);
  }

  /** Sealed resonance and Qtc read off a swept impedance curve, rather than computed. */
  findImpedancePeak(result: SweepResult | null, Re: number): { Fsc: number; Qtc: number } | null {
    return findImpedancePeak(result, Re);
  }

  // ── THE PASSIVE RADIATOR ──────────────────────────────────────────────────────────────────

  /** Added cone mass that tunes a radiator to `fp`. */
  prMassForFp(P: Parameters<typeof prMassForFp>[0], fp: number): number {
    return prMassForFp(P, fp);
  }

  /** Compliance-equivalent volume, in LITRES. */
  prVas(prCms: number, prSd: number): number { return prVas(prCms, prSd); }

  /** Compliance from Vas (litres) and Sd — the inverse of `prVas`. */
  prCmsFromVas(prVasL: number, prSd: number): number { return prCmsFromVas(prVasL, prSd); }

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
  sweep(drv: EngineDriver, box: BoxType, P: SweepParams): SweepResult {
    return sweep(drv, box, P);
  }

  /** The limit curves — how loud before excursion or port velocity gives out. */
  maxCurves(drv: EngineDriver, box: BoxType, P: SweepParams): MaxCurvesResult {
    return maxCurves(drv, box, P);
  }

  /** Whether the parameters can be swept at all, and what is wrong if not. */
  validateParams(box: BoxType, P: SweepParams): DriverError[] {
    return validateParams(box, P);
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

  /** A response the flat-clamp produced rather than the physics. */
  classifyFlatClamp(sw: SweepResult): DriverError | null {
    return classifyFlatClamp(sw);
  }

  /** Limit curves carrying a non-finite value. */
  classifyMaxFinite(mx: MaxCurvesResult): DriverError | null {
    return classifyMaxFinite(mx);
  }
}
