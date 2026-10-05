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


import {solveEnvironment} from './air.js';
import {hotRe} from './solvers/driverQuantities.js';
import {cAdd, cDiv, cInv, cMul, cScale, cx} from './complex.js';
import type {BoxType, Complex, Solution, SweepParams} from './types.js';
import {boxModel} from './boxes/index.js';
import type {BoxLoss, DriverSideQuantities} from './boxes/index.js';
import {LOSSLESS_LIMIT} from './sealedResonance.js';

// Re-exported unchanged: the box-specific box models (`./boxes/`) now own the port branch, but
// an existing import of `portImpedance`/`portLoss` from `circuit.js` still resolves.

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
/** The quantities the circuit CANNOT run without, every one required — measured, not declared:
 *  each is read unguarded below. `Le_H` is the only optional one, and absent means 0 H (no
 *  inductor specified), never unknown. Six named members, not a `Pick` over the driver's own bag
 *  (S2-10 — that bag is gone; a circuit is not a driver and does not need its whole shape). */
export interface CircuitQuantities {
    Sd_m2: number;
    Re_terminal_ohm: number;
    BL_terminal_Tm: number;
    Cms_m_per_N: number;
    Mms_kg: number;
    Rms_kg_per_s: number;
    /** Voice-coil inductance. The ONLY optional member — absent means no inductor specified,
     *  i.e. 0 H, never unknown. It affects the impedance plot alone (`Zcoil` below), which is
     *  why a driver without it still sweeps. */
    Le_H?: number;
    /** The BL the driver's Fs/Qes/Cms/Re imply, BL² = Re/(ωs·Qes·Cms) — read only by the
     *  'winisdGyrator' model. Absent means no second BL to disagree with `BL_entered_Tm`. */
    BL_Qes_Tm?: number;
    /** The BL the driver STATES, at the terminals. Equals `BL_terminal_Tm` unless "Use WinISD
     *  driver calculations" replaced the motor term's BL with the Qes-derived one; WinISD's `CLe`
     *  reads the entered figure either way (`fr_45e090` at 0x45e3ab, GHIDRA_FINDINGS.md). */
    BL_entered_Tm: number;
}

/** (BL_Qes/BL_entered)²: the factor WinISD's VCInd=1 model puts on Le. */
function winisdLeScale(drv: CircuitQuantities): number {
  if (drv.BL_Qes_Tm === undefined) return 1;
  return (drv.BL_Qes_Tm / drv.BL_entered_Tm) ** 2;
}

/** One voice coil's DC resistance as the circuit sees it: hot Re, plus Rg when Rg is at the driver side. */
function coilRdc(drv: CircuitQuantities, P: SweepParams): number {
  return hotRe(drv.Re_terminal_ohm, P.alfaVC ?? 0, P.vcTempRise ?? 0) + (P.rgAtDriverSide !== false ? (P.Rs || 0) : 0);
}

/** The lossless circuit's high-frequency SPL asymptote at `r_m`, Le excluded: |p| = ρ·|pg|/(2π·r·Mas)
 *  with the push `pg` from the entered BL. The transfer function's 0 dB (WinISD: fresh capture,
 *  BUG_20260926_winisd-tf-reference). */
export function hfAsymptotePressure_Pa(drv: CircuitQuantities, P: SweepParams, r_m: number): number {
  const n = P.nDrivers || 1;
  const series = (P.wiring || 'parallel') === 'series';
  const Rac = (series ? coilRdc(drv, P) * n : coilRdc(drv, P) / n) + (P.rgAtDriverSide !== false ? 0 : (P.Rs || 0));
  const BlPush = series ? drv.BL_entered_Tm * n : drv.BL_entered_Tm;
  const pg = P.eg * BlPush / (drv.Sd_m2 * n * Rac);
  const Mas = drv.Mms_kg / (drv.Sd_m2 * drv.Sd_m2) / n;
  const {rho} = solveEnvironment(P).values;
  return rho * pg / (2 * Math.PI * r_m * Mas);
}

/** The box is solved at `f`; the driver's own elements (coil, push, damping, ZaD) at `fDriver`,
 *  which is `f` except for WinISD's ABC group delay (`winisdAbcGroupDelay`): there WinISD steps
 *  the box to f ± δ and keeps the driver at the chart frequency. */
export function solve(f: number, drv: CircuitQuantities, box: BoxType, P: SweepParams, fDriver: number = f): Solution {
  const w      = 2 * Math.PI * f;
  const wd     = 2 * Math.PI * fDriver;
  const n      = P.nDrivers || 1;
  const wiring = P.wiring || 'parallel';
  const eg     = P.eg;
  const Sdt    = drv.Sd_m2 * n;

  const { rho, c } = solveEnvironment(P).values;

  // Voice coil impedance:
  //   ZcoilAC: resistive only (Re+Rs, Le excluded)
  //   Zcoil:   full Re+Rs+jωLe
  // P.circuitModel switch ('winisd' vs 'gyrator') controls whether Le is included in BOTH Zel and SPL:
  //   'winisd' (Simulate voice coil inductance unchecked): Le excluded from both Zel and acoustic circuit.
  //   'gyrator' (Simulate voice coil inductance checked): Le included in both Zel and acoustic circuit.
  // Thermal power compression (docs/research/WINISD_PARITY.md): the coil's DC resistance rises with temperature.
  // vcTempRise=0/absent → hotRe returns drv.Re_terminal_ohm exactly, so the circuit is unchanged (golden-safe).
  // Le is optional on a Driver (many datasheets omit it). Absent means "no inductor
  // specified", i.e. 0 H — NOT an unknown that should poison Zel with NaN.
  const Le = drv.Le_H ?? 0;
  // Source resistance placement (WinISD Advanced: "Rg is at driver side"). At the driver
  // side Rg belongs to each voice coil, so it scales with the array alongside Re; at the
  // amplifier a single Rg sits in series with the whole array. Identical when n = 1.
  // The impedance chart shows the array's own terminals: amplifier-side Rg drives the acoustic
  // circuit but is not part of Zel (WinISD, debugger capture, BUG_20260926).
  const Rg  = P.Rs || 0;
  const rgAtDriver = P.rgAtDriverSide !== false;
  const Rdc1 = coilRdc(drv, P);
  const arrayTerminals = (Le_H: number): Complex => {
    const z1 = cx(Rdc1, wd * Le_H);
    return wiring === 'series' ? cScale(z1, n) : cScale(z1, 1/n);
  };
  const arrayCoil = (Le_H: number): Complex =>
    rgAtDriver ? arrayTerminals(Le_H) : cAdd(arrayTerminals(Le_H), cx(Rg, 0));
  const ZcoilAC = arrayCoil(0);
  const Zcoil   = arrayCoil(Le);
  const Bl = wiring === 'series' ? drv.BL_terminal_Tm * n : drv.BL_terminal_Tm;
  // The motor's push uses the ENTERED BL; the damping (ZaE) uses `BL_terminal_Tm`. The two differ
  // only under "Enable WinISD two-BL driver bug", where WinISD takes its level from the entered BL
  // and its damping from Qes (debugger: entered BL 7.17 → 5.0 moves every SPL point by
  // 20·log10(5/7.17), BUG_20260926_winisd-spl-level-uses-entered-bl).
  const BlPush = wiring === 'series' ? drv.BL_entered_Tm * n : drv.BL_entered_Tm;

  // Acoustic pressure source and electrical damping.
  // 'winisd': Le excluded from the acoustic circuit — constant Rae/Uad (Le only for impedance).
  //   Source: docs/winisd_helpfiles/help/aboutequivalentcircuits.html
  // 'gyrator': textbook — the coil Re+Rs+jωLe drives the gyrator, one BL throughout.
  // 'winisdGyrator': WinISD's VCInd=1 model (winisd_research/GHIDRA_FINDINGS.md §"VCInd").
  //   WinISD builds the damping resistance Rae from Qes/Fs/Vas (the BL those imply) but the
  //   inductance's acoustic compliance CLe = Sd²·Le/BL² from the ENTERED BL. Through this
  //   circuit's single Bl that is an electrical inductance Le·(BL_Qes/BL)²; the two BLs agree,
  //   and the model reduces to 'gyrator', whenever the driver's BL is consistent with its Qes.
  let ZcoilForAC: Complex, ZcoilForZel: Complex;
  switch (P.circuitModel ?? 'winisd') {
    case 'winisd':        ZcoilForAC = ZcoilAC; ZcoilForZel = arrayTerminals(0);  break;
    case 'gyrator':       ZcoilForAC = Zcoil;   ZcoilForZel = arrayTerminals(Le); break;
    case 'winisdGyrator': ZcoilForAC = arrayCoil(Le * winisdLeScale(drv)); ZcoilForZel = arrayTerminals(Le); break;
  }
  const pg  = cDiv(cx(eg * BlPush, 0), cMul(cx(Sdt, 0), ZcoilForAC));
  const ZaE = cDiv(cx(Bl * Bl, 0), cMul(cx(Sdt * Sdt, 0), ZcoilForAC));

  // Driver acoustic elements derived from T/S parameters:
  // Cas = Cms·Sd²,  Mas = Mms/Sd²,  Ras = Rms/Sd²
  // https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
  const Cas = drv.Cms_m_per_N * drv.Sd_m2 * drv.Sd_m2 * n;
  const Mas = drv.Mms_kg / (drv.Sd_m2 * drv.Sd_m2) / n;
  const Ras = drv.Rms_kg_per_s / (drv.Sd_m2 * drv.Sd_m2) / n;
  const ZaD = cAdd(cAdd(cx(Ras, 0), cx(0, wd * Mas)), cInv(cx(0, wd * Cas)));

  // Box acoustic compliance Cab = Vb/(ρc²)
  // Loss resistances in parallel with compliance: Ral (leakage) and Raa (absorption)
  // https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
  const Cab = P.Vb / (rho * c * c);
  const Zc  = cInv(cx(0, w * Cab));
  const Ql  = P.Ql || 10;
  const Qa  = P.Qa || 100;
  const Ral = cx(Ql / (w * Cab), 0);
  const Raa = cx(Qa / (w * Cab), 0);

  const loss: BoxLoss = (Ql >= LOSSLESS_LIMIT && Qa >= LOSSLESS_LIMIT) ? 'lossless' : 'winisd-lossy';

  // The one place a `BoxType` becomes a topology's own circuit (`./boxes/`, mirroring
  // `../filters/index.ts`'s `filterModel()`).
  const shared: DriverSideQuantities = {w, pg, ZaE, ZaD, Cab, Zc, Ral, Raa, Ql, Qa, Cas, Mas, rho, c, loss};
  const {Zbox, UD, UP, U0, UPr, UPi} = boxModel(box, P).solve(shared);

  // Electrical input impedance Zel = Ze + Bl²/(Sd²·(ZaD+Zbox)), with the ENTERED BL as WinISD
  // uses it (BUG_20260926_winisd-impedance-uses-entered-bl).
  // https://en.wikipedia.org/wiki/Electrical_characteristics_of_a_dynamic_loudspeaker
  // Iso-barik: WinISD's motional term is twice the pair's (runs/sealed-w5-isobarik, 1e-15;
  // bugs/archive/BUG_20260928_isobarik-loading-not-simulated.md).
  const motional = cDiv(cx(BlPush * BlPush, 0), cMul(cx(Sdt * Sdt, 0), cAdd(ZaD, Zbox)));
  const Zel = cAdd(ZcoilForZel, P.loading === 'isobaric' ? cScale(motional, 2) : motional);
  return { U0, UD, UP, UPr, UPi, Zbox, Zel, ZaD };
}
