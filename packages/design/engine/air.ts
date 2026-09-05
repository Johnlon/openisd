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
 * That residual ppm gap is not a defect in THIS model — it is the difference between two
 * vapour-pressure curves. WinISD uses Hyland-Wexler and no enhancement factor; `winisdAir()`
 * below implements that exactly, and reproduces real WinISD to 25 ppb. This model stays
 * CIPM-2007 because CIPM-2007 is the metrological standard and the better description of real
 * air — the two models are a physics/parity pair, not a right/wrong pair.
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
 * When `useWinisdAirModel` is enabled, openisd switches to WinISD's parity air model. The
 * model choice is separate from the environment-source choice: `useAppLevelAirEnvironment`
 * decides whether the parity run takes `T`/`RH`/`p` from the app-level Options environment or
 * from this project's own box settings. Real WinISD computes `c`/`rho` live from its APP-LEVEL
 * Options dialog (§13, the only environment source it ever reads), so the app-level override
 * matches that source of truth when the parity model is selected. The UI resolves its
 * app-level environment equivalent (`presentationState.ui.envDefaults`, via
 * `logic/environment.ts`'s `resolveAirEnvironment`) before handing control to `winisdAir()`,
 * which implements WinISD's Hyland-Wexler vapour-pressure curve and derives density from
 * `gamma·p/c²`. Identified by controlled probe across six environments, the worst error is
 * 2.5e-8 (`winisd_research` FINDING-008). `useWinisdAirModel` defaults to true (QO95, reversing
 * QO7) so a new project matches WinISD out of the box; `useAppLevelAirEnvironment` defaults to
 * false.
 */

/** Ratio of specific heats for air. */
export const GAMMA = 1.4;

// Port end correction for a vent flanged at one end (baffle) and free at the other
// (open into the box) — WinISD's own default (Vents tab "End Correction" field;
// see docs/winisd_screenshots/view_3_ported.png).
/** Port end correction, × vent diameter, per open (unflanged) end. */
export const END_CORRECTION = 0.732;

/** Reference conditions — WinISD's Advanced-pane defaults, and openisd's own. */
export const DEFAULT_T_REF_K   = 293.15;
export const DEFAULT_RH_REF_PCT = 30;
export const DEFAULT_P_REF_PA  = 101325;
export const ZERO_C_IN_K = 273.15;

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
 * Ambient conditions a driver or project may hold, structurally compatible with `AirEnvironment`
 * minus its two model-selection flags — a provider hands over WHAT the air is, never which model
 * to compute it with. `airFor(provider ?? {})` accepts one directly.
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
  /** Use WinISD's parity air model instead of the physical model. Absent/false → the physical model. */
  useWinisdAirModel?: boolean;
  /** When the parity model is active, use the app-level environment values instead of this project's own `tempK` / `humidityPct` / `pressurePa`. */
  useAppLevelAirEnvironment?: boolean;
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
  return (humidityPct / 100) * enhancementFactor(pressurePa, tempK - ZERO_C_IN_K) * saturationVapourPressure(tempK) / pressurePa;
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
 * WinISD'S OWN AIR MODEL. Not an approximation of it, and NOTHING here is fitted: every constant
 * below is quoted from the document WinISD names as its source.
 *
 * PROVENANCE. WinISD's help: "Calculation of sound velocity and air density is derived from
 * Claus Futtrup's excellent documentation of Driver Parameter Calculator (DPC)"
 * (`docs/winisd_helpfiles/help/boxdesign.html`). DPC ships that documentation as `air.htm` and
 * `airmodel.htm`, also published at https://www.cfuttrup.com/dpc/air.htm — which states, in its
 * own words:
 *
 *   "MH = 18.020 is the molar mass for water"
 *   "ML = 28.965 is the molar mass for dry air"
 *   "RL = R = 8.314510, R is the gas constant 8.314510 J/(mol K)"
 *   "c = sqrt(gamma*p/rho) = sqrt(gamma*RT/M)"
 *   "For dry air gamma = 1.40 is a good estimate"
 *
 * TWO THINGS DIFFER FROM THE CIPM-2007 MODEL ABOVE, and both were MEASURED before being
 * explained (`winisd_research` FINDING-008 — six controlled environments, `c`/`roo` read out of
 * the `.wpr` at 15 significant digits):
 *
 *  1. DENSITY IS NOT COMPUTED FROM AIR AT ALL. WinISD computes `c`, then takes `rho` from
 *     `gamma·p/c²`. Verified to between 1.3e-15 and 2.6e-15 on all six. This is why five
 *     candidate DENSITY models were rejected in an earlier pass: they modelled a quantity
 *     WinISD never computes.
 *  2. THE VAPOUR-PRESSURE CURVE IS HYLAND-WEXLER (DPC's `airmodel.htm`), and there is NO
 *     enhancement factor. CIPM's curve and this one describe the same physical quantity but
 *     disagree by ~1.5e-4 at 20 °C, which dilutes through the ~0.7 % water content to the ~1e-5
 *     gap in `c` that nothing else could close.
 *
 * ACCURACY: worst 3.3e-15 across all six — DOUBLE-PRECISION EQUALITY, over a 40 K span, 0-80 %
 * humidity and 6 kPa of pressure. Within the limits of a double this is not a model OF WinISD's
 * calculation; it IS the calculation.
 *
 * THIS IS PARITY, NEVER PHYSICS. CIPM-2007 above is the metrological standard and the better
 * description of real air; DPC's model is a 1996 ideal-gas treatment that omits the enhancement
 * factor and rounds the molar masses, so it is the cruder of the two. It exists to reproduce
 * WinISD's numbers, which is why `openisd` uses the physical model by DEFAULT and offers this
 * only as an opt-in (QO7).
 */

/** Molar mass of dry air, kg/mol — DPC `air.htm`: "ML = 28.965 is the molar mass for dry air".
 *  Deliberately NOT `M_AIR` above: CIPM's 28.96546 carries a CO₂ correction DPC rounds away. */
const M_DRY_DPC = 28.965e-3;
/** Molar mass of water, kg/mol — DPC `air.htm`: "MH = 18.020 is the molar mass for water". */
const M_WATER_DPC = 18.020e-3;
/** Molar gas constant, J/(mol·K) — DPC `air.htm`: "R is the gas constant 8.314510 J/(mol K)".
 *  The 1986 CODATA value; CIPM-2007's `R_MOLAR` above is the newer 8.314472. The difference is
 *  4.6 ppm and it is the whole reason these molar masses cannot be used with `R_MOLAR`. */
const R_MOLAR_DPC = 8.314510;

/**
 * Saturation vapour pressure of water, Pa — Hyland & Wexler (1983), ASHRAE Transactions
 * 89(2A):500-519, as published by DPC (`airmodel.htm`, https://www.cfuttrup.com/dpc/airmodel.htm).
 *
 * TWO CONSTANT SETS, and the boundary is at exactly 0 °C. Over ice for -100 °C..0 °C, over
 * liquid water for 0 °C..200 °C. BOTH are needed even though nothing simulates below freezing:
 * 273.15 K itself is a measured environment, it takes the ICE set, and using the liquid set
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

function winisdAir(tempK: number, humidityPct: number, pressurePa: number): Air {
  // No enhancement factor: WinISD's mole fraction is the bare ratio, and adding CIPM's
  // correction here would be reintroducing the very difference this model exists to capture.
  const xv = (humidityPct / 100) * hylandWexlerVapourPressure(tempK) / pressurePa;
  const molarMass = M_DRY_DPC + xv * (M_WATER_DPC - M_DRY_DPC);
  const c = Math.sqrt(GAMMA * R_MOLAR_DPC * tempK / molarMass);
  return { rho: GAMMA * pressurePa / (c * c), c };
}

/**
 * The air for an environment — the single dispatch. Absent fields take the reference
 * conditions; `useWinisdAirModel` selects WinISD's behaviour instead of the physics.
 */
export function airFor(env: AirEnvironment): Air {
  const tempK = env.tempK ?? DEFAULT_T_REF_K;
  const humidityPct = env.humidityPct ?? DEFAULT_RH_REF_PCT;
  const pressurePa  = env.pressurePa  ?? DEFAULT_P_REF_PA;
  if (env.useWinisdAirModel) {
    // switches the calculation to the WinISD
    // equation set instead of the physical moist-air model.
    return winisdAir(tempK, humidityPct, pressurePa);
  }
  return {
    rho: moistAirDensity(tempK, humidityPct, pressurePa),
    c:   moistAirSoundVelocity(tempK, humidityPct, pressurePa),
  };
}
