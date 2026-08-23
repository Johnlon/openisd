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
 * `ignoreHumidityAndPressure` reproduces WinISD's behaviour of never reading the PROJECT's
 * `.wpr` `[Box]` section's stored T/RH/AP (confirmed inert there — §12): real WinISD computes
 * `c`/`roo` live from its APP-LEVEL Options dialog instead (§13, the only environment source
 * they ever read). This module still computes live from whatever temperature, humidity and
 * pressure the caller supplies — the UI substitutes its app-level Options-equivalent
 * (`presentationState.ui.envDefaults`, via `logic/environment.ts`'s `resolveAirEnvironment`)
 * before calling in — anchored to `WINISD_MEASURED_C_REF`/`WINISD_MEASURED_RHO_REF` (QO88)
 * so it reproduces
 * WinISD's own value exactly at the reference conditions and diverges from the physical model
 * off them by design (a real, ruled behaviour, not the fidelity gap this constant closes).
 * Ledger QO7 rules openisd uses the full physical model by DEFAULT and offers this as an opt-in.
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

/**
 * WinISD's own measured air pair at the reference conditions above. The raw IEEE-754 double
 * WinISD holds internally, captured live via gdb breakpoint on the write instruction
 * (`winisd_research/RE_GHIDRA_FINDINGS.md`, "LIVE DEBUGGER CAPTURE"): `c=343.6841209621523`,
 * `rho=1.200952177146823` — rounded here to 15 significant figures. NOTE: WinISD's saved
 * `.wpr` TEXT serializes `c` as `...153` (one ULP off the raw double, per
 * `CALC_FINDINGS_FOR_REVIEW.md` env_sample7) — the raw double is used here, not the text
 * form, per BUG_20260819's explicit ban on substituting one digit for the other; do not
 * "correct" this constant to `...153` without re-reading that bug first. No closed-form
 * reproduction of WinISD's internal live calculation has been recovered: five physically-
 * motivated candidates (this module's own CIPM-2007 model, Cramer's polynomial, full
 * CIPM+compressibility, the classical Rd=287.058/Magnus-Tetens meteorological formula,
 * dry-air-only) were checked against this exact point and every one missed by 8 ppm or more.
 * These two are measured ground truth, not derived — QO88 (John, 2026-08-23): the live-
 * calculated pair at these exact conditions must equal the constant the bridge stamps into
 * generated files.
 */
export const WINISD_MEASURED_C_REF   = 343.684120962152;
export const WINISD_MEASURED_RHO_REF = 1.20095217714682;

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
 * WinISD's air: computed live from the caller's temperature, humidity AND pressure
 * (`docs/design/WINISD_SCHEMA.md` §12/§13: `ignoreHumidityAndPressure` means "ignore the
 * PROJECT's stored `.wpr` [Box] environment", never "ignore these three live inputs" — the
 * UI passes its app-level Options-equivalent values here in that mode) — anchored to
 * `WINISD_MEASURED_C_REF`/
 * `WINISD_MEASURED_RHO_REF` by the ratio this module's own moist-air model gives between the
 * caller's conditions and the reference conditions. At exactly the reference conditions the
 * ratio is 1 and this returns the measured pair exactly; away from it, the result varies
 * continuously and physically, anchored to the one point that is actually verified — matching
 * every physically-motivated candidate this module's docstring above already tried and
 * matching none of them well enough on its own to use unanchored.
 */
function winisdAir(tempK: number, humidityPct: number, pressurePa: number): Air {
  const modelRho    = moistAirDensity(tempK, humidityPct, pressurePa);
  const modelC       = moistAirSoundVelocity(tempK, humidityPct, pressurePa);
  const modelRhoRef  = moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
  const modelCRef     = moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);
  return {
    rho: WINISD_MEASURED_RHO_REF * (modelRho / modelRhoRef),
    c:   WINISD_MEASURED_C_REF   * (modelC   / modelCRef),
  };
}

/**
 * The air for an environment — the single dispatch. Absent fields take the reference
 * conditions; `ignoreHumidityAndPressure` selects WinISD's behaviour instead of the physics.
 */
export function airFor(env: AirEnvironment): Air {
  const tempK = env.tempK ?? T_REF_K;
  const humidityPct = env.humidityPct ?? RH_REF_PCT;
  const pressurePa  = env.pressurePa  ?? P_REF_PA;
  if (env.ignoreHumidityAndPressure) return winisdAir(tempK, humidityPct, pressurePa);
  return {
    rho: moistAirDensity(tempK, humidityPct, pressurePa),
    c:   moistAirSoundVelocity(tempK, humidityPct, pressurePa),
  };
}
