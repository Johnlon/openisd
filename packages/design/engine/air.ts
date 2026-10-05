/**
 * Air properties — the one place ρ and c are produced from an environment. Every sweep, every
 * circuit solve and every UI readout calls `airFor`; nothing keeps a local copy of these formulas.
 *
 * ## The model: WinISD's own
 *
 * WinISD's help: "Calculation of sound velocity and air density is derived from Claus Futtrup's
 * excellent documentation of Driver Parameter Calculator (DPC)"
 * (`docs/winisd_helpfiles/help/boxdesign.html`). DPC ships that documentation as `air.htm` and
 * `airmodel.htm`, also published at https://www.cfuttrup.com/dpc/air.htm. From the project's
 * temperature T, relative humidity h and pressure p:
 *
 *     x_v = (h/100)·p_sv(T)/p          Hyland-Wexler p_sv, no enhancement factor
 *     M   = M_dry + x_v·(M_water − M_dry)
 *     c   = √(γ·R·T/M)
 *     ρ   = γ·p/c²
 *
 * Density is not computed from air at all: WinISD computes `c`, then takes `ρ` from `γ·p/c²`.
 * WinISD's own saved files hold `ρ·c² = γ·p` to 1.2e-15
 * (winisd_research/CALC_FINDINGS_FOR_REVIEW.md), so the box compliance `Cab = Vb/(ρc²)` depends
 * only on γ and p.
 *
 * Accuracy: measured against real WinISD at six controlled environments (`winisd_research`
 * FINDING-008 — a 40 K span, 0-80 % humidity, 6 kPa of pressure, `c`/`roo` read out of the
 * `.wpr` at 15 significant digits), worst residual 3.3e-15: double-precision equality.
 * `air.test.ts` pins it.
 *
 * This is the only air model. A CIPM-2007 moist-air model was removed 2026-10-05 (John): it
 * differed from this one by ~8 ppm in ρ and ~4 ppm in c, invisible on any chart.
 *
 * ## There is no frozen ρ/c constant, in WinISD or here
 *
 * Machine-verified against real WinISD 2026-08-20 (`docs/design/WINISD_SCHEMA.md` §12): a
 * driver's `c`/`roo` are always either the driver's OWN stated value, or CALCULATED — from
 * the driver's own remaining field, or from the app's live T/RH/AP — never a stored literal.
 * "Factory settings give 343.68" is a live computation landing on that number, not a
 * constant. This module holds no `RHO`/`C` for the same reason. Full provenance:
 * `docs/research/C_ROO_PROVENANCE.md`.
 */

import {NumberField} from '../fields/field.js';
import {missingDependencies} from './consistency.js';
import type {CalculationIssue} from './consistency.js';

/** Ratio of specific heats for air — DPC `air.htm`: "For dry air gamma = 1.40 is a good estimate". */
export const GAMMA = 1.4;

// Port end correction for a vent flanged at one end (baffle) and free at the other
// (open into the box) — WinISD's own default (Vents tab "End Correction" field;
// see docs/images/winisd/vents-tab.png).
/** Port end correction, × vent diameter, per open (unflanged) end. */
export const END_CORRECTION = 0.732;

/** Reference conditions — WinISD's Advanced-pane defaults, and openisd's own. */
export const DEFAULT_T_REF_K   = 293.15;
export const DEFAULT_RH_REF_PCT = 30;
export const DEFAULT_P_REF_PA  = 101325;
/** The band an entered temperature may fall in — the field's own, so the engine and the input
 *  cannot disagree about what temperature is enterable. */
export const MIN_SUPPORTED_TEMP_K = NumberField.ADV_TEMP_K.limits.min;
export const MAX_SUPPORTED_TEMP_K = NumberField.ADV_TEMP_K.limits.max;

/** The air a simulation runs in. */
export interface Air {
  /** Density, kg/m³. */
  readonly rho: number;
  /** Speed of sound, m/s. */
  readonly c: number;
}

/**
 * Ambient conditions a driver or project may hold, structurally compatible with `AirEnvironment`.
 * `airFor(provider ?? {})` accepts one directly.
 */
export interface AirConstantProvider {
  tempK?: number;
  humidityPct?: number;
  pressurePa?: number;
}

/**
 * The environment fields a caller may supply. `SweepParams` satisfies this structurally, so
 * the sweep and the circuit pass themselves straight to `airFor`.
 */
export interface AirEnvironment {
  /** Ambient temperature, K. Absent → `T_REF_K`. */
  tempK?: number;
  /** Relative humidity, PERCENT (0–100). Absent → `RH_REF_PCT`. The `.wpr` fraction is converted at that boundary. */
  humidityPct?: number;
  /** Static air pressure, Pa. Absent → `P_REF_PA`. */
  pressurePa?: number;
}

export type EnvironmentQuantityName = keyof AirEnvironment;
export type EnvironmentIssue = CalculationIssue<EnvironmentQuantityName>;

/**
 * An entered environment value outside the range the air model supports — normally
 * empty. Every `AirEnvironment` field defaults when absent (`airFor` always returns a usable
 * `Air`), so using the default is never a missing value; this channel exists only for an
 * explicitly entered `tempK` outside `MIN_SUPPORTED_TEMP_K`/`MAX_SUPPORTED_TEMP_K`. Reported
 * separately from `Air`, not bundled with it, so a caller that only wants `{ rho, c }` is not
 * forced to also destructure an issues array that is empty in the overwhelming common case.
 */
function environmentIssues(env: AirEnvironment): readonly EnvironmentIssue[] {
  const { tempK } = env;
  if (tempK == null || (tempK >= MIN_SUPPORTED_TEMP_K && tempK <= MAX_SUPPORTED_TEMP_K)) return [];
  return [missingDependencies('tempK', [{
    formula: `tempK must be between ${MIN_SUPPORTED_TEMP_K} K and ${MAX_SUPPORTED_TEMP_K} K`,
    required: ['tempK'], missing: ['tempK'],
  }])];
}

export interface EnvironmentSolveResult {
  readonly values: Air;
  readonly issues: readonly EnvironmentIssue[];
}

/** The unified environment solve (C5): the resolved `{ rho, c }` and the issues its stated
 *  conditions carry, from one call over the same entered environment — replaces separately
 *  calling `airFor` and `environmentIssues`, which could be handed different arguments and so
 *  describe two different environments. */
export function solveEnvironment(env: AirEnvironment): EnvironmentSolveResult {
  return { values: airFor(env), issues: environmentIssues(env) };
}

/** Molar mass of dry air, kg/mol — DPC `air.htm`: "ML = 28.965 is the molar mass for dry air". */
const M_DRY_DPC = 28.965e-3;
/** Molar mass of water, kg/mol — DPC `air.htm`: "MH = 18.020 is the molar mass for water". */
const M_WATER_DPC = 18.020e-3;
/** Molar gas constant, J/(mol·K) — DPC `air.htm`: "R is the gas constant 8.314510 J/(mol K)"
 *  (the 1986 CODATA value). */
const R_MOLAR_DPC = 8.314510;

/**
 * Saturation vapour pressure of water, Pa — Hyland & Wexler (1983), ASHRAE Transactions
 * 89(2A):500-519, as published by DPC (`airmodel.htm`, https://www.cfuttrup.com/dpc/airmodel.htm).
 *
 * Two constant sets, and the boundary is at exactly 0 °C: over ice for -100 °C..0 °C, over
 * liquid water for 0 °C..200 °C. Both are needed even though nothing simulates below freezing:
 * 273.15 K itself is a measured environment, it takes the ice set, and using the liquid set
 * there is wrong by 23 ppb — seven orders of magnitude worse than this model's actual accuracy.
 */
function hylandWexlerVapourPressure(tempK: number): number {
  if (tempK <= 273.15) {
    const C1 = -5.6745359e3, C2 = 6.3925247, C3 = -9.6778430e-3, C4 = 6.2215701e-7;
    const C5 = 2.0747825e-9, C6 = -9.4840240e-13, C7 = 4.1635019;
    return Math.exp(C1 / tempK + C2 + C3 * tempK + C4 * tempK ** 2
      + C5 * tempK ** 3 + C6 * tempK ** 4 + C7 * Math.log(tempK));
  }
  const C8 = -5.8002206e3, C9 = 1.3914993, C10 = -4.8640239e-2;
  const C11 = 4.1764768e-5, C12 = -1.4452093e-8, C13 = 6.5459673;
  return Math.exp(C8 / tempK + C9 + C10 * tempK + C11 * tempK ** 2
    + C12 * tempK ** 3 + C13 * Math.log(tempK));
}

/** WinISD's air: `c` from the moist-air molar mass, then `ρ = γ·p/c²` (see the module docstring). */
function winisdAir(tempK: number, humidityPct: number, pressurePa: number): Air {
  // No enhancement factor: WinISD's mole fraction is the bare ratio.
  const xv = (humidityPct / 100) * hylandWexlerVapourPressure(tempK) / pressurePa;
  const molarMass = M_DRY_DPC + xv * (M_WATER_DPC - M_DRY_DPC);
  const c = Math.sqrt(GAMMA * R_MOLAR_DPC * tempK / molarMass);
  return { rho: GAMMA * pressurePa / (c * c), c };
}

/** The air for an environment. Absent fields take the reference conditions. */
function airFor(env: AirEnvironment): Air {
  return winisdAir(
    env.tempK ?? DEFAULT_T_REF_K,
    env.humidityPct ?? DEFAULT_RH_REF_PCT,
    env.pressurePa ?? DEFAULT_P_REF_PA,
  );
}
