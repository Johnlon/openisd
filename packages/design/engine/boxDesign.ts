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

import { END_CORRECTION, T_REF_K, RH_REF_PCT, P_REF_PA, moistAirDensity, moistAirSoundVelocity } from './air.js';
import type { EngineDriver, SweepParams, SweepResult } from './types.js';

// None of the box/vent/PR geometry callers below carry a project environment (T/RH/AP) --
// computed live at the reference environment, same basis `driver.ts`'s fallback uses. Never
// a stored constant.
const refRho = (): number => moistAirDensity(T_REF_K, RH_REF_PCT, P_REF_PA);
const refC = (): number => moistAirSoundVelocity(T_REF_K, RH_REF_PCT, P_REF_PA);

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
export function ebp(drv: Pick<EngineDriver, 'Fs' | 'Qes'>): number { return drv.Fs / drv.Qes; }

/**
 * Sealed box volume for a target system Q (Qtc).
 * Qtc = Qts · √(1 + Vas/Vb)  →  Vb = Vas / ((Qtc/Qts)² − 1)
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
export function sealedFromQtc(drv: Pick<EngineDriver, 'Qts' | 'Vas'>, Qtc: number): number | null {
  const ratio = (Qtc / drv.Qts) ** 2 - 1;
  return ratio <= 0 ? null : drv.Vas / ratio;
}

/**
 * QB3 vented alignment — polynomial fit to Thiele's alignment tables.
 * Vb = 15 · Vas · Qts^2.87
 * fb = Fs · √(Vas / Vb)
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 */
export function ventedAlignment(drv: Pick<EngineDriver, 'Fs' | 'Qts' | 'Vas'>): { Vb: number; Fb: number } {
  const Vb = 15 * drv.Vas * Math.pow(drv.Qts, 2.87);
  return { Vb, Fb: drv.Fs * Math.pow(drv.Vas / Vb, 0.5) };
}

/**
 * Physical vent length for a target tuning frequency.
 * Helmholtz resonator: f = (c/2π) · √(A / (V₀ · L_eq))
 * where L_eq = L + END_CORRECTION·d  (flanged at the baffle, free into the box)
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 * The result is the RAW SIGNED root, never clamped. The end correction alone already supplies
 * acoustic mass, so every volume + port area has a ceiling — the tuning at L = 0 — above which
 * the equation's only solution is a negative length. That negative IS the answer: it says the
 * target is unreachable and by how much, it round-trips exactly through `tuningFromLength()`,
 * and callers guard on `> 0`. Flooring it instead would return a buildable-looking vent that
 * tunes somewhere else entirely, which is a wrong number wearing a right one's clothes.
 */
export function ventLength(Vb: number, fb: number, Sp: number, endCorrection: number = END_CORRECTION): number {
  const Cab = Vb / (refRho() * refC() * refC());
  const wb  = 2 * Math.PI * fb;
  const Map = 1 / (wb * wb * Cab);
  const d   = 2 * Math.sqrt(Sp / Math.PI);
  return Map * Sp / refRho() - endCorrection * d;
}

/**
 * Port tuning frequency from physical dimensions.
 * f = (c/2π) · √(Sp / (Vb · L_eq))  where L_eq = L + END_CORRECTION·d
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function tuningFromLength(Vb: number, L: number, Sp: number, endCorrection: number = END_CORRECTION): number {
  const d    = 2 * Math.sqrt(Sp / Math.PI);
  const Leff = L + endCorrection * d;
  const Cab  = Vb / (refRho() * refC() * refC());
  const Map  = refRho() * Leff / Sp;
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
}

/**
 * Passive radiator system resonance frequency.
 * PR compliance Cap = prCms·prSd² combines with box compliance Cab in series:
 * Cpar = Cab·Cap/(Cab+Cap);  fp = 1/(2π·√(Map·Cpar))
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
export function prTuning(P: PRParams): number {
  const Cab  = P.Vb / (refRho() * refC() * refC());
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
  const Cab  = P.Vb / (refRho() * refC() * refC());
  const Cap  = P.prCms! * P.prSd! * P.prSd!;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  const Map  = 1 / ((2 * Math.PI * fp) ** 2 * Cpar);
  return Map * P.prSd! * P.prSd!;
}

/**
 * Finds the actual system resonance (Fsc) and Q (Qtc) from the simulated impedance curve
 * of a sealed/closed box, taking box leakage/absorption losses into account (TS method).
 */
export function findImpedancePeak(result: SweepResult | null, Re: number): { Fsc: number; Qtc: number } | null {
  if (!result || result.fs.length === 0 || !Re || Re <= 0) return null;

  let maxZ = -1;
  let peakIdx = -1;
  for (let i = 0; i < result.fs.length; i++) {
    if (result.zmag[i] > maxZ) {
      maxZ = result.zmag[i];
      peakIdx = i;
    }
  }

  if (peakIdx === -1 || maxZ <= Re) return null;

  const peakFreq = result.fs[peakIdx];
  const r0 = maxZ / Re;
  if (r0 <= 1) return null;
  const Z_target = Re * Math.sqrt(r0);

  // Find f1 (below peakIdx)
  let f1 = -1;
  for (let i = peakIdx; i >= 0; i--) {
    if (result.zmag[i] <= Z_target) {
      const fA = result.fs[i];
      const fB = result.fs[i + 1];
      const zA = result.zmag[i];
      const zB = result.zmag[i + 1];
      if (zB !== zA) {
        f1 = fA + (Z_target - zA) * (fB - fA) / (zB - zA);
      } else {
        f1 = fA;
      }
      break;
    }
  }

  // Find f2 (above peakIdx)
  let f2 = -1;
  for (let i = peakIdx; i < result.fs.length; i++) {
    if (result.zmag[i] <= Z_target) {
      const fA = result.fs[i - 1];
      const fB = result.fs[i];
      const zA = result.zmag[i - 1];
      const zB = result.zmag[i];
      if (zB !== zA) {
        f2 = fA + (Z_target - zA) * (fB - fA) / (zB - zA);
      } else {
        f2 = fA;
      }
      break;
    }
  }

  if (f1 === -1 || f2 === -1 || f2 <= f1) {
    return { Fsc: peakFreq, Qtc: 0 };
  }

  const Qmc = (peakFreq * Math.sqrt(r0)) / (f2 - f1);
  const Qtc = Qmc / r0;

  return { Fsc: peakFreq, Qtc };
}

