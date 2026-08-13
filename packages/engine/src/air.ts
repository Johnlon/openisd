/**
 * Air properties — the ONE place ρ and c are produced from an environment. Every sweep,
 * every circuit solve and every UI readout calls `airFor`; nothing keeps a local copy of
 * these formulas.
 *
 * ## The physical model (default)
 *
 * Density is the CIPM-2007 moist-air composition — BIPM's recommended formulation, Picard,
 * Davis, Gläser & Fujii, *Metrologia* **45** (2008) 149–155 — evaluated as an ideal gas
 * (compressibility factor Z omitted):
 *
 *     ρ = p·M_a/(R·T) · [1 − x_v·(1 − M_v/M_a)]
 *     x_v = (h/100)·f(p,t)·p_sv(t)/p
 *
 * with CIPM's own saturation vapour pressure `p_sv` and enhancement factor `f`.
 *
 * Speed of sound is Laplace's adiabatic relation at that density:
 *
 *     c = √(γ·p/ρ),   γ = 1.4
 *
 * ## Why that pairing, and not Cramer's polynomial
 *
 * WinISD's own saved files hold `ρ·c² = γ·p` with γ = 1.4 to **1.2e-15** relative
 * (`1.20095217714682 × 343.684120962153² = 141855.00000000017`, `1.4 × 101325 = 141855.0` —
 * winisd_research/CALC_FINDINGS_FOR_REVIEW.md). That identity is measured, not assumed, so it
 * is the constraint this model is built to satisfy. It also keeps the engine self-consistent:
 * the box compliance `Cab = Vb/(ρc²)` then depends only on γ and p.
 *
 * Evaluated at WinISD's Advanced-pane defaults — 293.15 K, 30 % RH, 101325 Pa — this returns
 * `ρ = 1.2009621` and `c = 343.68270`, which are **8.3 ppm** and **4.1 ppm** from WinISD's own
 * stored `1.20095217714682` / `343.684120962153`. Cramer's speed-of-sound polynomial
 * (*JASA* **93** (1993) 2510) lands 151 ppm away, and full CIPM-2007 density including Z lands
 * 381 ppm away, so both fit WinISD's pair markedly worse. `air.test.ts` pins the agreement.
 *
 * ## The WinISD-parity mode
 *
 * WinISD stores temperature, pressure and humidity in the `.wpr` `[Box]` section and never
 * reads them: its `c`/`roo` stay at those 15 digits through a forced recompute at 303.15 K and
 * come back at them when the two fields are deleted and regenerated. Ledger QO7 rules that
 * openisd uses the physical model by DEFAULT and offers WinISD's behaviour as an opt-in, so
 * `ignoreHumidityAndPressure` drops back to the `RHO`/`C` constants scaled by temperature
 * alone. It costs about 0.077 dB of SPL at 30 °C.
 */

import { RHO, C } from './constants.js';

/** Ratio of specific heats for air. */
export const GAMMA = 1.4;

/** Reference conditions — WinISD's Advanced-pane defaults, and openisd's own. */
export const T_REF_K   = 293.15;
export const RH_REF_PCT = 30;
export const P_REF_PA  = 101325;

/** Molar gas constant, J/(mol·K) — CIPM-2007. */
const R_MOLAR = 8.314472;
/** Molar mass of dry air at 400 µmol/mol CO₂, kg/mol — CIPM-2007. */
const M_AIR = 28.96546e-3;
/** Molar mass of water, kg/mol — CIPM-2007. */
const M_WATER = 18.01528e-3;

/** The air a simulation runs in. */
export interface Air {
  /** Density, kg/m³. */
  readonly rho: number;
  /** Speed of sound, m/s. */
  readonly c: number;
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
  /** Opt in to WinISD's behaviour of ignoring humidity and pressure. Absent/false → the physical model. */
  ignoreHumidityAndPressure?: boolean;
}

/**
 * Saturation vapour pressure of water over liquid, Pa, from absolute temperature —
 * CIPM-2007 `p_sv = exp(A·T² + B·T + C + D/T)`. ~2339 Pa at 20 °C.
 */
export function saturationVapourPressure(tempK: number): number {
  const A = 1.2378847e-5, B = -1.9121316e-2, Cc = 33.93711047, D = -6.3431645e3;
  return Math.exp(A * tempK * tempK + B * tempK + Cc + D / tempK);
}

/**
 * CIPM-2007 enhancement factor `f = α + β·p + γ·t²` — the correction for water vapour not
 * behaving as an ideal gas in the presence of air. Within 0.4 % of 1 over the whole range.
 */
function enhancementFactor(pressurePa: number, tempC: number): number {
  return 1.00062 + 3.14e-8 * pressurePa + 5.6e-7 * tempC * tempC;
}

/**
 * Mole fraction of water vapour in the mixture: `x_v = (h/100)·f(p,t)·p_sv(t)/p`.
 * Linear in relative humidity, and exactly 0 in dry air.
 */
export function waterVapourMoleFraction(tempK: number, humidityPct: number, pressurePa: number): number {
  return (humidityPct / 100) * enhancementFactor(pressurePa, tempK - 273.15) * saturationVapourPressure(tempK) / pressurePa;
}

/** Moist-air density, kg/m³ — CIPM-2007 composition as an ideal gas (see the module docstring). */
export function moistAirDensity(tempK: number, humidityPct: number, pressurePa: number): number {
  const xv = waterVapourMoleFraction(tempK, humidityPct, pressurePa);
  return (pressurePa * M_AIR / (R_MOLAR * tempK)) * (1 - xv * (1 - M_WATER / M_AIR));
}

/** Speed of sound in moist air, m/s — `c = √(γ·p/ρ)` at the density above. */
export function moistAirSoundVelocity(tempK: number, humidityPct: number, pressurePa: number): number {
  return Math.sqrt(GAMMA * pressurePa / moistAirDensity(tempK, humidityPct, pressurePa));
}

/**
 * WinISD's air: the fixed `RHO`/`C` pair, scaled by temperature alone (ρ ∝ 1/T, c ∝ √T).
 * Returns `RHO` and `C` exactly at `T_REF_K`.
 */
function winisdAir(tempK: number): Air {
  return { rho: RHO * (T_REF_K / tempK), c: C * Math.sqrt(tempK / T_REF_K) };
}

/**
 * The air for an environment — the single dispatch. Absent fields take the reference
 * conditions; `ignoreHumidityAndPressure` selects WinISD's behaviour instead of the physics.
 */
export function airFor(env: AirEnvironment): Air {
  const tempK = env.tempK ?? T_REF_K;
  if (env.ignoreHumidityAndPressure) return winisdAir(tempK);
  const humidityPct = env.humidityPct ?? RH_REF_PCT;
  const pressurePa  = env.pressurePa  ?? P_REF_PA;
  return {
    rho: moistAirDensity(tempK, humidityPct, pressurePa),
    c:   moistAirSoundVelocity(tempK, humidityPct, pressurePa),
  };
}
