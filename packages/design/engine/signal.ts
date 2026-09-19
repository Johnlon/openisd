/**
 * Signal Resolver — the drive value used by the circuit, from whatever the project states about
 * power, driver resistance, driver count, wiring, and series resistance.
 *
 * T5: voltage is not part of the data model — the project states power only, or nothing (the
 * established 1 W reference is a valid, complete input, not a missing value). `drive_V` is
 * ALWAYS derived, never stored, so there is no pair to disagree with itself; the one issue is a
 * missing `Re_ohm`.
 */

import type {Wiring} from './types.js';
import type {CalculationIssue, SolveRoute} from './consistency.js';
import {driveVoltage} from './formulas.js';

/** Named long-form (`packages/design/AGENTS.md`, "Concrete types over flexi-shit"), not built
 *  from a field-name list. `driverCount`/`wiring`/`seriesResistance_ohm` describe the load the
 *  drive is delivered into; they are carried through unresolved here — nothing in this module
 *  yet derives a formula from them. */
export interface SignalSolverQuantities {
  power_W?: number;
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

/** WinISD's own reference drive level — used only when the project has stated no power, so it is
 *  not a missing value: it is the standard the industry (and this engine's own `driveVoltage`)
 *  already measures sensitivity and SPL against. */
const REFERENCE_POWER_W = 1;

const DRIVE_V_ROUTE: SolveRoute<SignalQuantityName> = Object.freeze({
  formula: 'drive_V = √(power_W · Re_ohm) (power_W defaults to the 1 W reference)',
  required: Object.freeze(['Re_ohm'] as const), missing: Object.freeze(['Re_ohm'] as const),
});

export function solveSignal(entered: SignalSolverQuantities): SignalSolveResult {
  const { power_W, Re_ohm } = entered;
  const values: SignalSolverQuantities = { ...entered };
  const issues: SignalIssue[] = [];

  if (usable(Re_ohm)) {
    values.drive_V = driveVoltage(usable(power_W) ? power_W : REFERENCE_POWER_W, Re_ohm);
  } else {
    issues.push({ kind: 'missing-dependencies', target: 'drive_V', routes: [DRIVE_V_ROUTE] });
  }

  return { values, issues };
}
