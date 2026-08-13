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
 * Oracle: `drivers/sample/winisd/John-all-manu-populated.wdr`, a genuine WinISD save whose
 * stored `c`/`roo`/`no`/`SPL` these formulas reproduce to floating-point identity — proved by
 * `packages/engine/test/efficiency.test.ts`, which cross-checks against the independent
 * motor-side route ρ/(2πc)·BL²Sd²/(Re·Mms²).
 */

import { P0 } from './constants.js';

/** 4π²/c³ — the coefficient of the Fs³·Vas/Qes efficiency form, at the speed of sound `c`. */
export function efficiencyConstant(c: number): number {
  return (4 * Math.PI ** 2) / c ** 3;
}

/** Reference efficiency η₀ as a FRACTION: (4π²/c³)·Fs³·Vas/Qes. Fs in Hz, Vas in m³. */
export function referenceEfficiency(Fs: number, Vas: number, Qes: number, c: number): number {
  return efficiencyConstant(c) * Fs ** 3 * Vas / Qes;
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
