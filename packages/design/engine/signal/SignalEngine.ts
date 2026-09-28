/**
 * The signal area — the drive power and drive voltage, related through the driver's DC resistance:
 * `power_W = voltage_V² / Re_ohm`.
 *
 * With a usable Re, whichever of the two is entered fixes the other, written as calculated.
 * Without one, the power is not available (the issue names Re) and the voltage keeps what it
 * holds — a voltage is always present, so a sweep always has one.
 */

import {missingDependencies} from '../consistency.js';
import type {CalculationIssue} from '../consistency.js';
import type {SignalSolverParams} from '../solverTypes.js';

export type SignalQuantityName = keyof SignalSolverParams;
export type SignalIssue = CalculationIssue<SignalQuantityName>;

const usable = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;

const POWER_FORMULA = 'power_W = voltage_V² / Re_ohm';
const POWER_INPUTS: readonly SignalQuantityName[] = Object.freeze(['voltage_V', 'Re_ohm'] as const);

/**
 * Drive voltage from reference (system) power, voice-coil resistance, and series resistance:
 * V = √(Pin · (Re + Rs)).
 * Matches WinISD's reference-power convention where input power is total power into (Re + Rs).
 */
export function driveVoltage(pin: number, re: number, rs: number = 0): number {
  return Math.sqrt(pin * (re + (rs > 0 ? rs : 0)));
}

/**
 * Reference power from drive voltage, voice-coil resistance, and series resistance — the inverse of `driveVoltage`:
 * P = V² / (Re + Rs).
 */
export function driveFromVoltage(eg: number, re: number, rs: number = 0): number {
  const r = re + (rs > 0 ? rs : 0);
  return r > 0 ? (eg * eg) / r : 0;
}

/** The signal area of the engine: the drive voltage and drive power, related through the
 *  driver's DC resistance, and the handle solve between them. */
export interface SignalEngine {
  /** The voltage that delivers `pin` watts into `re` (+ `rs`) ohms. */
  driveVoltage(pin: number, re: number, rs?: number): number;
  /** With a usable Re: an entered V writes P = V²/Re as calculated, otherwise P writes
   *  V = √(P·Re) as calculated. Without Re: P not available, with the issue naming Re. */
  solve(p: SignalSolverParams): readonly SignalIssue[];
}

export class SignalEngineImpl implements SignalEngine {
  readonly driveVoltage = driveVoltage;

  solve(p: SignalSolverParams): readonly SignalIssue[] {
    const Re_ohm = p.Re_ohm.value;
    const Rs_ohm = p.Rs_ohm?.value ?? 0;
    if (usable(Re_ohm)) {
      if (p.voltage_V.entered) {
        p.power_W.setCalculated(driveFromVoltage(p.voltage_V.value, Re_ohm, Rs_ohm));
        return [];
      }
      const power_W = p.power_W.value;
      if (usable(power_W)) {
        p.voltage_V.setCalculated(this.driveVoltage(power_W, Re_ohm, Rs_ohm));
        return [];
      }
    }
    p.power_W.setNotAvailable();
    return [missingDependencies('power_W',
      [{ formula: POWER_FORMULA, required: POWER_INPUTS, missing: usable(Re_ohm) ? ['voltage_V'] : ['Re_ohm'] }])];
  }
}
