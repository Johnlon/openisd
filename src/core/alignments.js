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

import { RHO, C } from './constants.js';

/**
 * Efficiency Bandwidth Product — criterion for enclosure type selection.
 * EBP = Fs / Qes.  EBP < 50 → sealed preferred; EBP > 100 → vented preferred.
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
 */
export function ebp(drv) { return drv.Fs / drv.Qes; }

/**
 * Sealed box volume for a target system Q (Qtc).
 * Qtc = Qts · √(1 + Vas/Vb)  →  Vb = Vas / ((Qtc/Qts)² − 1)
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
export function sealedFromQtc(drv, Qtc) {
  const ratio = (Qtc / drv.Qts) ** 2 - 1;
  return ratio <= 0 ? null : drv.Vas / ratio;
}

/**
 * QB3 vented alignment — polynomial fit to Thiele's alignment tables.
 * Vb = 15 · Vas · Qts^2.87
 * fb = Fs · √(Vas / Vb)
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
export function ventedAlignment(drv) {
  const Vb = 15 * drv.Vas * Math.pow(drv.Qts, 2.87);
  return { Vb, Fb: drv.Fs * Math.pow(drv.Vas / Vb, 0.5) };
}

/**
 * Physical vent length for a target tuning frequency.
 * Helmholtz resonator: f = (c/2π) · √(A / (V₀ · L_eq))
 * where L_eq = L + 0.85·d  (end correction for one open flanged end)
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function ventLength(Vb, fb, Sp) {
  const Cab = Vb / (RHO * C * C);
  const wb  = 2 * Math.PI * fb;
  const Map = 1 / (wb * wb * Cab);
  const d   = 2 * Math.sqrt(Sp / Math.PI);
  return Math.max(Map * Sp / RHO - 0.85 * d, 0.005);
}

/**
 * Port tuning frequency from physical dimensions.
 * f = (c/2π) · √(Sp / (Vb · L_eq))  where L_eq = L + 0.85·d
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function tuningFromLength(Vb, L, Sp) {
  const d    = 2 * Math.sqrt(Sp / Math.PI);
  const Leff = L + 0.85 * d;
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
export function prTuning(P) {
  const Cab  = P.Vb / (RHO * C * C);
  const Map  = (P.prMmd + P.prMadd) / (P.prSd * P.prSd);
  const Cap  = P.prCms * P.prSd * P.prSd;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cpar));
}

/**
 * PR moving mass required to achieve a target fp.
 * Inverts prTuning(): Map = 1/((2π·fp)²·Cpar),  Mmp = Map·prSd²
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function prMassForFp(P, fp) {
  const Cab  = P.Vb / (RHO * C * C);
  const Cap  = P.prCms * P.prSd * P.prSd;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  const Map  = 1 / ((2 * Math.PI * fp) ** 2 * Cpar);
  return Map * P.prSd * P.prSd;
}
