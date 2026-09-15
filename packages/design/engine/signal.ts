/**
 * Signal Resolver — the drive value used by the circuit, from whatever the project states about
 * power, voltage, driver resistance, driver count, wiring, and series resistance.
 *
 * PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md "Signal Resolver": the established 1 W project
 * reference is a valid, complete input — not a missing value — so it resolves `drive_V` with no
 * issue. Missing `Re_ohm` (with no `voltage_V` stated directly either) or a stated power/voltage
 * pair that disagrees with the stated `Re_ohm` are signal issues.
 */

import type { Wiring } from './types.js';
import type { CalculationIssue, SolveRoute } from './consistency.js';
import { driveVoltage } from './formulas.js';

/** Named long-form (`packages/design/AGENTS.md`, "Concrete types over flexi-shit"), not built
 *  from a field-name list. `driverCount`/`wiring`/`seriesResistance_ohm` describe the load the
 *  drive is delivered into; they are carried through unresolved here — nothing in this module
 *  yet derives a formula from them. */
export interface SignalSolverQuantities {
  power_W?: number;
  voltage_V?: number;
  Re_ohm?: number;
  driverCount?: number;
  wiring?: Wiring;
  seriesResistance_ohm?: number;
  drive_V?: number;
}

export type SignalQuantityName = keyof SignalSolverQuantities;
export type SignalIssue = CalculationIssue<SignalQuantityName>;

export interface SignalSolveResult {
  readonly values: SignalSolverQuantities;
  readonly issues: readonly SignalIssue[];
}

const usable = (v: number | undefined): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** WinISD's own reference drive level — used only when the project has stated neither a power
 *  nor a voltage, so it is not a missing value: it is the standard the industry (and this
 *  engine's own `driveVoltage`) already measures sensitivity and SPL against. */
const REFERENCE_POWER_W = 1;

const DRIVE_V_ROUTE: SolveRoute<SignalQuantityName> = Object.freeze({
  formula: 'drive_V = voltage_V, or √(power_W · Re_ohm) (power_W defaults to the 1 W reference)',
  required: Object.freeze(['Re_ohm'] as const), missing: Object.freeze(['Re_ohm'] as const),
});

export function solveSignal(entered: SignalSolverQuantities): SignalSolveResult {
  const { power_W, voltage_V, Re_ohm } = entered;
  const values: SignalSolverQuantities = { ...entered };
  const issues: SignalIssue[] = [];

  if (usable(power_W) && usable(voltage_V) && usable(Re_ohm)) {
    const expected = driveVoltage(power_W, Re_ohm);
    const relative = Math.abs(expected - voltage_V) / Math.abs(voltage_V);
    if (relative > 1e-9) {
      issues.push({
        kind: 'inconsistent-inputs', target: 'voltage_V', fields: ['power_W', 'voltage_V', 'Re_ohm'],
        formula: 'voltage_V = √(power_W · Re_ohm)', expected, actual: voltage_V, relative,
      });
    }
  }

  if (values.drive_V == null) {
    if (usable(voltage_V)) {
      values.drive_V = voltage_V;
    } else if (usable(Re_ohm)) {
      values.drive_V = driveVoltage(usable(power_W) ? power_W : REFERENCE_POWER_W, Re_ohm);
    } else {
      issues.push({ kind: 'missing-dependencies', target: 'drive_V', routes: [DRIVE_V_ROUTE] });
    }
  }

  return { values, issues };
}
