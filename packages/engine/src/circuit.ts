/**
 * Lumped-element acoustical circuit solver.
 *
 * Circuit element equations:
 *
 *   Driver acoustic elements (Cas, Mas, Ras from T/S parameters):
 *   https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
 *
 *   Port tuning (Helmholtz resonator, Map = ρ·Leff/Sp):
 *   https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 *
 *   Loudspeaker electrical characteristics (Ze, gyrator, Zel):
 *   https://en.wikipedia.org/wiki/Electrical_characteristics_of_a_dynamic_loudspeaker
 *
 * Authoritative sources (paywalled):
 *   Small, R.H. "Direct-Radiator Loudspeaker System Analysis." JAES 20(5) 1972.
 *   https://aes.org/e-lib/browse.cfm?elib=2008
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


import { hotRe } from './driver.js';
import { cx, cAdd, cSub, cMul, cDiv, cInv, cScale, cPar, cTanh } from './complex.js';
import type { Complex, Driver, BoxType, SweepParams, Solution } from './types.js';

export function portLoss(w: number, Map: number, P: Pick<SweepParams, 'Qp'>): number {
  return w * Map / (P.Qp || 100);
}

/**
 * Port acoustic impedance — lumped mass, or a transmission line when `tlPortModel` is set
 * (WinISD Advanced: `Use "transmission line"-model for port simulation`).
 *
 * Lumped: Zp = Rap + jω·Map, with Map = ρ·Leff/Sp. Valid while the duct is short against a
 * wavelength; being monotonic in ω it has no pipe resonance, so it over-predicts port output
 * above the duct's own fundamental.
 *
 * Transmission line: the input impedance of a uniform lossy duct of length Leff and area Sp,
 * terminated by the mouth's radiation load.
 *   https://en.wikipedia.org/wiki/Acoustic_transmission_line
 *   Z0    = ρc/Sp                       characteristic acoustic impedance
 *   γ     = k/Qp + jk,  k = ω/c         propagation constant; the real part is chosen so the
 *                                       ω→0 limit reproduces the lumped Rap = ω·Map/Qp exactly,
 *                                       which keeps Qp's meaning identical in both models
 *   Zrad  = Z0·(ka)²/4,  a = √(Sp/π)    RESISTIVE part only of the piston radiation load
 *                                       (https://en.wikipedia.org/wiki/Acoustic_impedance#Radiation_impedance)
 *   Zp    = Z0·(Zrad + Z0·tanh γL)/(Z0 + Zrad·tanh γL)
 *
 * Only the resistive part of the radiation load is added because the REACTIVE part is exactly
 * what the end correction already folded into Leff (Leff = L + endCorrection·d). Adding it
 * again would double-count the mouth mass and drop the tuning. With that split, tanh(γL) → γL
 * as ω→0 gives Zp → Rap + jω·Map — the lumped model, to the last bit.
 */
export function portImpedance(w: number, P: SweepParams): Complex {
  const Sp = P.Sp!, Leff = P.Leff!;
  const tempK = P.tempK ?? 293.15;
  const c     = 343.68 * Math.sqrt(tempK / 293.15);
  const rho   = 1.20095 * (293.15 / tempK);

  const Map = rho * Leff / Sp, Rap = portLoss(w, Map, P);
  if (!P.tlPortModel) return cAdd(cx(Rap, 0), cx(0, w * Map));
  const k    = w / c;
  const Z0   = rho * c / Sp;
  const a    = Math.sqrt(Sp / Math.PI);              // equivalent piston radius
  const Zrad = cx(Z0 * 0.25 * (k * a) * (k * a), 0); // resistive radiation load at the mouth
  const th   = cTanh(cx(k * Leff / (P.Qp || 100), k * Leff));
  const num  = cAdd(Zrad, cScale(th, Z0));
  const den  = cAdd(cx(Z0, 0), cMul(Zrad, th));
  return cScale(cDiv(num, den), Z0);
}

/**
 * Solve the acoustic circuit at frequency f (Hz).
 *
 * Models the motor + enclosure as an impedance network using the acoustical
 * mobility analogy (pressure → voltage, volume velocity → current).
 * https://en.wikipedia.org/wiki/Electrical_characteristics_of_a_dynamic_loudspeaker
 *
 * Returns U0 (net output volume velocity), UD (driver), UP (port/PR),
 * and Zel (electrical input impedance).
 */
export function solve(f: number, drv: Driver, box: BoxType, P: SweepParams): Solution {
  const w      = 2 * Math.PI * f;
  const n      = P.nDrivers || 1;
  const wiring = P.wiring || 'parallel';
  const eg     = P.eg;
  const Sdt    = drv.Sd * n;

  const tempK = P.tempK ?? 293.15;
  const c     = 343.68 * Math.sqrt(tempK / 293.15);
  const rho   = 1.20095 * (293.15 / tempK);

  // Voice coil impedance — two variants matching WinISD's model split:
  //   ZcoilAC: resistive only (Le excluded) — used for acoustic circuit (SPL, GD, excursion)
  //   Zcoil:   full Re+Rs+jωLe            — used only for electrical impedance plot
  // Source: research/winisd/help/aboutequivalentcircuits.html
  //   "Ze = Re + jω·Le + Zem" — Le added back only for impedance, not for acoustic simulation
  // https://en.wikipedia.org/wiki/Electrical_characteristics_of_a_dynamic_loudspeaker
  // Thermal power compression (WINISD.md §12c): the coil's DC resistance rises with temperature.
  // vcTempRise=0/absent → hotRe returns drv.Re exactly, so the circuit is unchanged (golden-safe).
  // Le is optional on a Driver (many datasheets omit it). Absent means "no inductor
  // specified", i.e. 0 H — NOT an unknown that should poison Zel with NaN.
  const Le = drv.Le ?? 0;
  // Source resistance placement (WinISD Advanced: "Rg is at driver side"). At the driver
  // side Rg belongs to each voice coil, so it scales with the array alongside Re; at the
  // amplifier a single Rg sits in series with the whole array. Identical when n = 1.
  const Rg  = P.Rs || 0;
  const rgAtDriver = P.rgAtDriverSide !== false;
  const Rdc1 = hotRe(drv.Re, P.alfaVC ?? 0, P.vcTempRise ?? 0) + (rgAtDriver ? Rg : 0);
  const Zcoil1AC = cx(Rdc1, 0);
  const Zcoil1   = cAdd(cx(Rdc1, 0), cx(0, w * Le));
  let ZcoilAC: Complex, Zcoil: Complex, Bl: number;
  if (wiring === 'series') { ZcoilAC = cScale(Zcoil1AC, n); Zcoil = cScale(Zcoil1, n);     Bl = drv.Bl * n; }
  else                     { ZcoilAC = cScale(Zcoil1AC, 1/n); Zcoil = cScale(Zcoil1, 1/n); Bl = drv.Bl; }
  if (!rgAtDriver) { ZcoilAC = cAdd(ZcoilAC, cx(Rg, 0)); Zcoil = cAdd(Zcoil, cx(Rg, 0)); }

  // Acoustic pressure source and electrical damping.
  // WinISD mode: Le excluded from acoustic circuit — constant Rae/Uad (Le only for impedance).
  //   Source: research/winisd/help/aboutequivalentcircuits.html
  // Full gyrator: Le included — physically more complete but diverges from WinISD.
  const ZcoilForAC = (P.circuitModel === 'gyrator') ? Zcoil : ZcoilAC;
  const pg  = cDiv(cx(eg * Bl, 0), cMul(cx(Sdt, 0), ZcoilForAC));
  const ZaE = cDiv(cx(Bl * Bl, 0), cMul(cx(Sdt * Sdt, 0), ZcoilForAC));

  // Driver acoustic elements derived from T/S parameters:
  // Cas = Cms·Sd²,  Mas = Mms/Sd²,  Ras = Rms/Sd²
  // https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
  const Cas = drv.Cms * drv.Sd * drv.Sd * n;
  const Mas = drv.Mms / (drv.Sd * drv.Sd) / n;
  const Ras = drv.Rms / (drv.Sd * drv.Sd) / n;
  const ZaD = cAdd(cAdd(cx(Ras, 0), cx(0, w * Mas)), cInv(cx(0, w * Cas)));

  // Box acoustic compliance Cab = Vb/(ρc²)
  // Loss resistances in parallel with compliance: Ral (leakage) and Raa (absorption)
  // https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
  const Cab = P.Vb / (rho * c * c);
  const Zc  = cInv(cx(0, w * Cab));
  const Ql  = P.Ql || 10;
  const Qa  = P.Qa || 100;
  const Ral = cx(Ql / (w * Cab), 0);
  const Raa = cx(Qa / (w * Cab), 0);

  let Zbox!: Complex, U0!: Complex, UD!: Complex;
  let UP: Complex = cx(0, 0);

  if (box === 'sealed') {
    Zbox = cPar(Zc, Ral, Raa);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    U0 = UD;

  } else if (box === 'vented') {
    // Port branch — lumped mass Map = ρ·Leff/Sp (Leff = L + END_CORRECTION·d), or a
    // transmission line when P.tlPortModel is set. See portImpedance().
    // https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
    const Zport = portImpedance(w, P);
    Zbox = cPar(Zc, Ral, Raa, Zport);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zbox, Zport));
    U0 = cSub(UD, UP);

  } else if (box === 'pr') {
    // Passive radiator: mechanical elements referred to acoustical domain
    // https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
    // n_pr PRs in parallel → combined acoustic impedance = Zpr_single / n_pr
    const n_pr = P.prNum || 1;
    const Map = (P.prMmd! + P.prMadd!) / (P.prSd! * P.prSd!);
    const Cap = P.prCms! * P.prSd! * P.prSd!;
    const Rap = (P.prRms || 0) / (P.prSd! * P.prSd!);
    const Zpr_single = cAdd(cAdd(cx(Rap, 0), cx(0, w * Map)), cInv(cx(0, w * Cap)));
    const Zpr = n_pr > 1 ? cScale(Zpr_single, 1 / n_pr) : Zpr_single;
    Zbox = cPar(Zc, Ral, Raa, Zpr);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zbox, Zpr));
    U0 = cSub(UD, UP);

  } else if (box === 'bandpass4') {
    // 4th-order bandpass: rear sealed chamber + front vented chamber
    const Cabr   = P.Vb / (rho * c * c);
    const Zr     = cPar(cInv(cx(0, w * Cabr)), cx(Ql / (w * Cabr), 0), cx(Qa / (w * Cabr), 0));
    const Cabf   = P.Vf! / (rho * c * c);
    const Zportf = portImpedance(w, P);
    const Zf     = cPar(cInv(cx(0, w * Cabf)), cx(Ql / (w * Cabf), 0), cx(Qa / (w * Cabf), 0), Zportf);
    Zbox = cAdd(Zr, Zf);
    UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
    UP = cMul(UD, cDiv(Zf, Zportf));
    U0 = UP;
  }

  // Electrical input impedance Zel = Ze + Bl²/(Sd²·(ZaD+Zbox))
  // https://en.wikipedia.org/wiki/Electrical_characteristics_of_a_dynamic_loudspeaker
  const Zel = cAdd(Zcoil, cDiv(cx(Bl * Bl, 0), cMul(cx(Sdt * Sdt, 0), cAdd(ZaD, Zbox))));
  return { U0, UD, UP, Zbox, Zel, ZaD };
}
