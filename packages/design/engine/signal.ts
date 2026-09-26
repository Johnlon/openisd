/**
 * Signal solve — the drive power and drive voltage, related through the driver's DC resistance:
 * `power_W = voltage_V² / Re_ohm`.
 *
 * With a usable Re, whichever of the two is entered fixes the other, written as calculated.
 * Without one, the power is not available (the issue names Re) and the voltage keeps what it
 * holds — a voltage is always present, so a sweep always has one.
 */

import type {CalculationIssue} from './consistency.js';
import {driveFromVoltage, driveVoltage} from './formulas.js';
import type {SignalSolverParams} from './solverTypes.js';

export type SignalQuantityName = keyof SignalSolverParams;
export type SignalIssue = CalculationIssue<SignalQuantityName>;

const usable = (v: number | null): v is number => v !== null && Number.isFinite(v) && v > 0;

const POWER_FORMULA = 'power_W = voltage_V² / Re_ohm';
const POWER_INPUTS: readonly SignalQuantityName[] = Object.freeze(['voltage_V', 'Re_ohm'] as const);

export function solveSignal(p: SignalSolverParams): readonly SignalIssue[] {
  const Re_ohm = p.Re_ohm.value;
  const Rs_ohm = p.Rs_ohm?.value ?? 0;
  if (usable(Re_ohm)) {
    if (p.voltage_V.entered) {
      p.power_W.setCalculated(driveFromVoltage(p.voltage_V.value, Re_ohm, Rs_ohm));
      return [];
    }
    const power_W = p.power_W.value;
    if (usable(power_W)) {
      p.voltage_V.setCalculated(driveVoltage(power_W, Re_ohm, Rs_ohm));
      return [];
    }
  }
  p.power_W.setNotAvailable();
  return [{
    kind: 'missing-dependencies',
    target: 'power_W',
    routes: [{ formula: POWER_FORMULA, required: POWER_INPUTS, missing: usable(Re_ohm) ? ['voltage_V'] : ['Re_ohm'] }],
  }];
}
