/**
 * Enclosure alignment calculations.
 *
 * T/S parameter equations:
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
 *
 * Port tuning (Helmholtz resonator):
 *   https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 * Authoritative sources (paywalled):
 *   Thiele, A.N. "Loudspeakers in Vented Boxes, Part I." JAES 19(5) 1971.
 *   https://aes.org/e-lib/browse.cfm?elib=1967
 *
 *   Small, R.H. "Closed-Box Loudspeaker Systems — Part I." JAES 20(10) 1972.
 *   https://aes.org/e-lib/browse.cfm?elib=2062
 *
 *   Small, R.H. "Vented-Box Loudspeaker Systems — Part I." JAES 21(5) 1973.
 *   https://aes.org/e-lib/browse.cfm?elib=2149
 *
 *   Small, R.H. "Passive-Radiator Loudspeaker Systems — Part I." JAES 22(8) 1974.
 *   https://aes.org/e-lib/browse.cfm?elib=2223
 */

import { RHO, C, END_CORRECTION } from './constants.js';
import type { Driver, SweepParams } from './types.js';

/** The subset of params the PR helpers read — lets callers pass any params object
 *  (engine SweepParams, or the UI's UiParams/SyncedParams) that carries these fields. */
type PRParams = Pick<SweepParams, 'Vb' | 'prMmd' | 'prMadd' | 'prSd' | 'prCms'>;

// Each alignment helper takes exactly the T/S fields it reads (a full Driver or a
// bare T/S fixture both satisfy the Pick — they never touch the derived Cms/Mms/Bl).

/**
 * Efficiency Bandwidth Product — criterion for enclosure type selection.
 * EBP = Fs / Qes.  EBP < 50 → sealed preferred; EBP > 100 → vented preferred.
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
 */
export function ebp(drv: Pick<Driver, 'Fs' | 'Qes'>): number { return drv.Fs / drv.Qes; }

/**
 * Sealed box volume for a target system Q (Qtc).
 * Qtc = Qts · √(1 + Vas/Vb)  →  Vb = Vas / ((Qtc/Qts)² − 1)
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
export function sealedFromQtc(drv: Pick<Driver, 'Qts' | 'Vas'>, Qtc: number): number | null {
  const ratio = (Qtc / drv.Qts) ** 2 - 1;
  return ratio <= 0 ? null : drv.Vas / ratio;
}

/**
 * Sealed-box (or passive-radiator primary chamber) resonance for a GIVEN volume — the
 * inverse direction of sealedFromQtc (which solves Vb for a target Qtc; this solves Fc for
 * a known Vb). Fc = Fs · √(1 + Vas/Vb).
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
export function sealedFc(drv: Pick<Driver, 'Fs' | 'Vas'>, Vb: number): number | null {
  return Vb > 0 ? drv.Fs * Math.sqrt(1 + drv.Vas / Vb) : null;
}

/**
 * QB3 vented alignment — polynomial fit to Thiele's alignment tables.
 * Vb = 15 · Vas · Qts^2.87
 * fb = Fs · √(Vas / Vb)
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
export function ventedAlignment(drv: Pick<Driver, 'Fs' | 'Qts' | 'Vas'>): { Vb: number; Fb: number } {
  const Vb = 15 * drv.Vas * Math.pow(drv.Qts, 2.87);
  return { Vb, Fb: drv.Fs * Math.pow(drv.Vas / Vb, 0.5) };
}

/**
 * Physical vent length for a target tuning frequency.
 * Helmholtz resonator: f = (c/2π) · √(A / (V₀ · L_eq))
 * where L_eq = L + END_CORRECTION·d  (flanged at the baffle, free into the box)
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function ventLength(Vb: number, fb: number, Sp: number, endCorrection: number = END_CORRECTION): number {
  const Cab = Vb / (RHO * C * C);
  const wb  = 2 * Math.PI * fb;
  const Map = 1 / (wb * wb * Cab);
  const d   = 2 * Math.sqrt(Sp / Math.PI);
  return Math.max(Map * Sp / RHO - endCorrection * d, 0.005);
}

/**
 * Port tuning frequency from physical dimensions.
 * f = (c/2π) · √(Sp / (Vb · L_eq))  where L_eq = L + END_CORRECTION·d
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function tuningFromLength(Vb: number, L: number, Sp: number, endCorrection: number = END_CORRECTION): number {
  const d    = 2 * Math.sqrt(Sp / Math.PI);
  const Leff = L + endCorrection * d;
  const Cab  = Vb / (RHO * C * C);
  const Map  = RHO * Leff / Sp;
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
}

/**
 * Passive radiator system resonance frequency.
 * PR compliance Cap = prCms·prSd² combines with box compliance Cab in series:
 * Cpar = Cab·Cap/(Cab+Cap);  fp = 1/(2π·√(Map·Cpar))
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function prTuning(P: PRParams): number {
  const Cab  = P.Vb / (RHO * C * C);
  const Map  = (P.prMmd! + P.prMadd!) / (P.prSd! * P.prSd!);
  const Cap  = P.prCms! * P.prSd! * P.prSd!;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cpar));
}

/**
 * PR moving mass required to achieve a target fp.
 * Inverts prTuning(): Map = 1/((2π·fp)²·Cpar),  Mmp = Map·prSd²
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function prMassForFp(P: PRParams, fp: number): number {
  const Cab  = P.Vb / (RHO * C * C);
  const Cap  = P.prCms! * P.prSd! * P.prSd!;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  const Map  = 1 / ((2 * Math.PI * fp) ** 2 * Cpar);
  return Map * P.prSd! * P.prSd!;
}
