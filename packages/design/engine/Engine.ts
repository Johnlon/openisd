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
import { ebp, prTuning } from './alignments.js';
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

  /** Reference efficiency, in the air the caller states. */
  referenceEfficiency(Fs: number, Vas: number, Qes: number, env: AirEnvironment): number {
    return referenceEfficiency(Fs, Vas, Qes, airFor(env).c);
  }

  /** SPL for a given efficiency, in the air the caller states. */
  splFromEfficiency(no: number, env: AirEnvironment): number {
    const air = airFor(env);
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
