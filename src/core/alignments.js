'use strict';
// Depends on: constants (RHO, C)
const { RHO, C } = typeof window !== 'undefined' ? window.R : require('./constants.js');

// =========================================================================
//  ALIGNMENT HELPERS — box sizing and tuning utilities.
// =========================================================================

// Efficiency-bandwidth product: < 50 → sealed preferred; > 100 → vented preferred.
function ebp(drv) { return drv.Fs / drv.Qes; }

// Returns sealed Vb (m³) for a target system Q (Qtc).
function sealedFromQtc(drv, Qtc) {
  const ratio = (Qtc / drv.Qts) ** 2 - 1;
  if (ratio <= 0) return null;
  return drv.Vas / ratio;
}

// QB3/B4-family vented alignment suggestion.  Returns {Vb (m³), Fb (Hz)}.
function ventedAlignment(drv) {
  const { Qts, Fs, Vas } = drv;
  const Vb   = 15 * Vas * Math.pow(Qts, 2.87);
  const alpha = Vas / Vb;
  const fbB4  = Fs * Math.pow(alpha, 0.5);
  return { Vb, Fb: fbB4 };
}

// Physical vent length (m) for a given tuning frequency.
function ventLength(Vb, fb, Sp) {
  const Cab = Vb / (RHO * C * C);
  const wb  = 2 * Math.PI * fb;
  const Map = 1 / (wb * wb * Cab);
  const d   = 2 * Math.sqrt(Sp / Math.PI);
  const L   = Map * Sp / RHO - 0.85 * d;  // effective − end correction (one flanged end)
  return Math.max(L, 0.005);
}

// Tuning frequency (Hz) for a given physical vent length.
function tuningFromLength(Vb, L, Sp) {
  const d    = 2 * Math.sqrt(Sp / Math.PI);
  const Leff = L + 0.85 * d;
  const Cab  = Vb / (RHO * C * C);
  const Map  = RHO * Leff / Sp;
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
}

// Passive-radiator system tuning Fp (Hz).
// PR mass resonates against box air spring (Cab) in parallel with PR suspension (Cap).
function prTuning(P) {
  const Cab  = P.Vb / (RHO * C * C);
  const Map  = P.prMmp / (P.prSd * P.prSd);
  const Cap  = P.prCms * P.prSd * P.prSd;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  return 1 / (2 * Math.PI * Math.sqrt(Map * Cpar));
}

// PR moving mass (kg) required to hit a target tuning frequency.
function prMassForFp(P, fp) {
  const Cab  = P.Vb / (RHO * C * C);
  const Cap  = P.prCms * P.prSd * P.prSd;
  const Cpar = (Cab * Cap) / (Cab + Cap);
  const Map  = 1 / ((2 * Math.PI * fp) ** 2 * Cpar);
  return Map * P.prSd * P.prSd;
}

const API = { ebp, sealedFromQtc, ventedAlignment, ventLength, tuningFromLength, prTuning, prMassForFp };
if (typeof module !== 'undefined') module.exports = API;
if (typeof window !== 'undefined') window.R = Object.assign(window.R || {}, API);
