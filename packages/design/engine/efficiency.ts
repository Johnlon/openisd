/**
 * Reference efficiency η₀ and the 1 W/1 m sensitivity derived from it — the ONE
 * implementation. Every other package calls these; none keeps a copy.
 *
 * η₀ is a FRACTION (a genuine WinISD save stores ~8.8e-6, not ~8.8e-4). WinISD's editor
 * DISPLAYS it as a percent; that ×100 belongs to the display layer and never to a stored
 * or computed value.
 *
 * The additive SPL constant is NOT a literal:
 *
 *     SPL = K + 10·log₁₀(η₀),    K = 10·log₁₀(ρ·c / (2π·p_ref²))
 *
 * 109, 112.1 and 112.2 are all rounded approximations of K. Because openisd derives ρ and c
 * from temperature, pressure and humidity (ledger QO7), K moves with the air — about
 * 0.07 dB from 20 °C to 30 °C — so it is computed from the ρ and c actually in use.
 *
 * Oracle: `drivers/mysamples/winisd/John-all-manu-populated.wdr`, a genuine WinISD save whose
 * stored `c`/`roo`/`no`/`SPL` these formulas reproduce to floating-point identity — proved by
 * `packages/engine/test/efficiency.test.ts`, which cross-checks against the independent
 * motor-side route ρ/(2πc)·BL²Sd²/(Re·Mms²).
 */

import {P0} from './constants.js';
import {V283_SQ} from './driver/routes/constants.js';

/** 4π²/c³ — the coefficient of the Fs³·Vas/Qes efficiency form, at the speed of sound `c`. */
export function efficiencyConstant(c: number): number {
  return (4 * Math.PI ** 2) / c ** 3;
}

/** Reference efficiency η₀ as a FRACTION: (4π²/c³)·Fs³·Vas/Qes. Fs in Hz, Vas in m³. */
export function referenceEfficiency(Fs: number, Vas: number, Qes: number, c: number): number {
  return efficiencyConstant(c) * Fs ** 3 * Vas / Qes;
}

/**
 * Reference efficiency η₀ from the driver's own motor and geometry — the route WinISD takes
 * (rel 15, site 0x45fc3b, winisd_research/scripts/relation_routes.py) when Fs/Vas/Qes cannot
 * reach η₀ because Vas is still blank: ρ/(2πc)·BL²·Sd²/(Re·Mms²). Same η₀ as
 * `referenceEfficiency` — reached independently, with no Vas.
 */
export function motorEfficiency(rho: number, c: number, BL: number, Sd: number, Mms: number, Re: number): number {
  return (rho / (2 * Math.PI * c)) * (BL ** 2 * Sd ** 2) / (Re * Mms ** 2);
}

/**
 * K, the additive constant of `SPL = K + 10·log₁₀(η₀)`, for the air in use:
 * 10·log₁₀(ρ·c / (2π·p_ref²)). Half-space radiation of one acoustic watt, referred to 1 m
 * and to p_ref = 20 µPa.
 */
export function splReferenceConstantDb(rho: number, c: number): number {
  return 10 * Math.log10((rho * c) / (2 * Math.PI * P0 * P0));
}

/** 1 W / 1 m reference sensitivity (dB) from a FRACTIONAL η₀. */
export function splFromEfficiency(no: number, rho: number, c: number): number {
  return splReferenceConstantDb(rho, c) + 10 * Math.log10(no);
}

/** The exact inverse: FRACTIONAL η₀ implied by a stated 1 W/1 m sensitivity. */
export function efficiencyFromSpl(spl: number, rho: number, c: number): number {
  return Math.pow(10, (spl - splReferenceConstantDb(rho, c)) / 10);
}

/**
 * The driver's sensitivity at 2.83 V and 1 m (USPL) from its 1 W / 1 m sensitivity and Re: 2.83² W into Re is
 * 2.83²/Re watts, so USPL = SPL + 10·log₁₀(2.83²/Re). `2.83² = 8.0089`, not the bare 8 (docs/spec/SPEC_ENGINE.md
 * "USPL / SPLmax"). The one copy: the USPL routes on the stated SPL and on SPLref both call it (T902).
 */
export function splAt283V(spl1W_dB: number, Re_ohm: number): number {
  return spl1W_dB + 10 * Math.log10(V283_SQ / Re_ohm);
}

/** The inverse of `splAt283V` for Re: the Re at which 2.83 V gives `uspl_dB` when 1 W gives `spl1W_dB`. */
export function reFromSplAt283V(uspl_dB: number, spl1W_dB: number): number {
  return V283_SQ / Math.pow(10, (uspl_dB - spl1W_dB) / 10);
}

/** The inverse of `splAt283V` for the 1 W / 1 m sensitivity: USPL less the 2.83 V power gain through Re. */
export function spl1WFromSplAt283V(uspl_dB: number, Re_ohm: number): number {
  return uspl_dB - 10 * Math.log10(V283_SQ / Re_ohm);
}

/**
 * Maximum SPL at the rated power Pe (WinISD's SPLmax): the 1 W / 1 m sensitivity + 10·log₁₀(Pe) − 3 dB
 * (docs/spec/SPEC_ENGINE.md "USPL / SPLmax"). The one copy: the SPLmax routes on the stated SPL and on SPLref both
 * call it (T902).
 */
export function splMaxAtRatedPower(spl1W_dB: number, Pe_W: number): number {
  return spl1W_dB + 10 * Math.log10(Pe_W) - 3;
}
