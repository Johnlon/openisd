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
 *     c = √(γ·p/ρ)
 *
 * ## Why that pairing, and not Cramer's polynomial
 *
 * WinISD's own saved files hold `ρ·c² = γ·p` to **1.2e-15** relative
 * (winisd_research/CALC_FINDINGS_FOR_REVIEW.md). That identity is measured, not assumed, so it
 * is the constraint this model is built to satisfy. It also keeps the engine self-consistent:
 * the box compliance `Cab = Vb/(ρc²)` then depends only on γ and p.
 *
 * Evaluated at WinISD's Advanced-pane defaults (`T_REF_K`/`RH_REF_PCT`/`P_REF_PA` below), this
 * model is **8.3 ppm** off ρ and **4.1 ppm** off c from WinISD's own live-computed pair.
 * Cramer's speed-of-sound polynomial (*JASA* **93** (1993) 2510) lands 151 ppm away, and full
 * CIPM-2007 density including Z lands 381 ppm away, so both fit WinISD's pair markedly worse.
 * `air.test.ts` pins the agreement.
 *
 * ## There is no frozen ρ/c constant, in WinISD or here
 *
 * Machine-verified against real WinISD 2026-08-20 (`docs/design/WINISD_SCHEMA.md` §12): a
 * driver's `c`/`roo` are always either the driver's OWN stated value, or CALCULATED — from
 * the driver's own remaining field, or from the app's live T/RH/AP — never a stored literal.
 * "Factory settings give 343.68" is a live computation landing on that number, not a
 * constant. This module holds no `RHO`/`C` for the same reason.
 *
 * ## The WinISD-parity mode
 *
 * `ignoreHumidityAndPressure` reproduces WinISD's behaviour of never reading the `.wpr`
 * `[Box]` section's stored T/RH/AP — it still computes live, at `RH_REF_PCT`/`P_REF_PA`
 * rather than whatever was supplied, using only the caller's temperature. Ledger QO7 rules
 * openisd uses the full physical model by DEFAULT and offers this as an opt-in.
 */

/** Ratio of specific heats for air. */
export const GAMMA = 1.4;

// Port end correction for a vent flanged at one end (baffle) and free at the other
// (open into the box) — WinISD's own default (Vents tab "End Correction" field;
// see docs/winisd_screenshots/view_3_ported.png).
/** Port end correction, × vent diameter, per open (unflanged) end. */
export const END_CORRECTION = 0.732;

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
 * WinISD's air: computed live from the caller's temperature alone, at `RH_REF_PCT`/
 * `P_REF_PA` — humidity and pressure inputs are accepted but ignored, matching WinISD's
 * own refusal to read the `.wpr` `[Box]` section's stored values.
 */
function winisdAir(tempK: number): Air {
  return { rho: moistAirDensity(tempK, RH_REF_PCT, P_REF_PA), c: moistAirSoundVelocity(tempK, RH_REF_PCT, P_REF_PA) };
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
