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

import type {EbpSuitability, SweepResult} from './types.js';

// JL: FIXME - suspect - why not the params from the DS or why specicla pr params needed for this
/** The subset of params the PR helpers read — lets callers pass any params object
 *  (engine SweepParams, or the UI's UiParams/SyncedParams) that carries these fields. */
// Each alignment helper takes exactly the T/S fields it reads (a full Driver or a
// bare T/S fixture both satisfy the Pick — they never touch the derived Cms/Mms/Bl).

/**
 * Efficiency Bandwidth Product — criterion for enclosure type selection.
 * EBP = Fs / Qes.  EBP < 50 → sealed preferred; EBP > 100 → vented preferred.
 * https://en.wikipedia.org/wiki/Thiele/Small_parameters#Other_parameters
 */
export function ebp(Fs_hz: number, Qes: number): number { return Fs_hz / Qes; }

export function ebpSuitability(EBP_hz: number): EbpSuitability {
  if (EBP_hz < 50) return 'sealed';
  if (EBP_hz > 100) return 'vented';
  return 'either';
}

/**
 * WinISD's vented-alignment polynomials, one pair per alignment: `alpha = exp(P_alpha(ln Qts))`,
 * `h = exp(P_h(ln Qts))`. Coefficients highest degree first, read as 10-byte x87 literals from
 * `winisd.exe` `0x5ea700`–`0x5ea9e0` (`winisd_research/GHIDRA_FINDINGS.md`, "VENTED ALIGNMENT
 * MECHANISM FOUND — `0x46afd0`"). They are the program's own fits to the classic Ql=7 alignment
 * tables; Ql is not an input to these four. Captures cover Qts' 0.25–0.60.
 */
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
  // r0 = maxZ/Re is always > 1 here: the guard above already refused maxZ <= Re, and Re > 0
  // was refused earlier still, so a "r0 <= 1" guard here could never fire — removed rather
  // than left as dead defensive code.
  const r0 = maxZ / Re;
  const Z_target = Re * Math.sqrt(r0);

  // Find f1 (below peakIdx)
  let f1 = -1;
  for (let i = peakIdx; i >= 0; i--) {
    if (result.zmag[i] <= Z_target) {
      const fA = result.fs[i];
      const fB = result.fs[i + 1];
      const zA = result.zmag[i];
      const zB = result.zmag[i + 1];
      // zB is the previous loop iteration's point (one step towards the peak): it failed this
      // same "<= Z_target" test, so zB > Z_target >= zA strictly — zA and zB can never be
      // equal, so the interpolation denominator is never zero.
      f1 = fA + (Z_target - zA) * (fB - fA) / (zB - zA);
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
      // zA is the previous loop iteration's point (one step towards the peak): it failed this
      // same "<= Z_target" test, so zA > Z_target >= zB strictly — never equal to zB.
      f2 = fA + (Z_target - zA) * (fB - fA) / (zB - zA);
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
