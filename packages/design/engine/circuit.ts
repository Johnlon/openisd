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
import {hotRe} from './solver.js';
import {cAdd, cDiv, cInv, cMul, cPar, cScale, cSub, cTanh, cx} from './complex.js';
import type {BoxType, Complex, Solution, SweepParams} from './types.js';
import type {LossModeValue} from './lossMode.js';

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
  const { rho, c } = solveEnvironment(P).values;

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

export function solve(f: number, drv: CircuitQuantities, box: BoxType, P: SweepParams): Solution {
  const w      = 2 * Math.PI * f;
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
    const z1 = cx(Rdc1, w * Le_H);
    return wiring === 'series' ? cScale(z1, n) : cScale(z1, 1/n);
  };
  const arrayCoil = (Le_H: number): Complex =>
    rgAtDriver ? arrayTerminals(Le_H) : cAdd(arrayTerminals(Le_H), cx(Rg, 0));
  const ZcoilAC = arrayCoil(0);
  const Zcoil   = arrayCoil(Le);
  const Bl = wiring === 'series' ? drv.BL_terminal_Tm * n : drv.BL_terminal_Tm;
  // The motor's push uses the ENTERED BL; the damping (ZaE) uses `BL_terminal_Tm`. The two differ
  // only under "Use WinISD driver calculations", where WinISD takes its level from the entered BL
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

  const lossMode: LossModeValue = (Ql >= 1e6 && Qa >= 1e6) ? 'lossless' : (P.lossMode ?? 'winisd-lossy');

  if (box === 'sealed') {
    switch (lossMode) {
      case 'lossless': {
        Zbox = Zc;
        UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        U0 = UD;
        break;
      }
      case 'conventional-lossy': {
        Zbox = cPar(Zc, Ral, Raa);
        UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        U0 = UD;
        break;
      }
      case 'winisd-lossy': {
        const Cat = (Cas * Cab) / (Cas + Cab);
        const wsc = 1 / Math.sqrt(Cat * Mas);
        const RalConst = cx(Ql / (wsc * Cab), 0);
        // WinISD's absorption: ωsc·Mas/Qa in series with Cab (BUG_20260926_winisd-box-absorption-is-series).
        const RaaSeries = cx(wsc * Mas / Qa, 0);
        Zbox = cPar(RalConst, cAdd(RaaSeries, Zc));
        UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        const Uleak = cMul(UD, cDiv(Zbox, RalConst));
        U0 = cSub(UD, Uleak);
        break;
      }
      default: {
        const _exhaustiveCheck: never = lossMode;
        throw new Error(`Unhandled LossModeValue: ${_exhaustiveCheck}`);
      }
    }

  } else if (box === 'vented') {
    switch (lossMode) {
      case 'lossless':
      case 'conventional-lossy': {
        // Port branch — lumped mass Map = ρ·Leff/Sp (Leff = L + END_CORRECTION·d), or a
        // transmission line when P.tlPortModel is set. See portImpedance(). Ral/Raa are the
        // same per-frequency Ql/Qa/(ω·Cab) the sealed box's own conventional-lossy branch uses;
        // for 'lossless' they are effectively absent because Ql/Qa are then ≥1e6.
        // https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
        const Zport = portImpedance(w, P);
        Zbox = cPar(Zc, Ral, Raa, Zport);
        UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        UP = cMul(UD, cDiv(Zbox, Zport));
        U0 = cSub(UD, UP);
        break;
      }
      case 'winisd-lossy': {
        // WinISD's vented box (winisd_research/GHIDRA_FINDINGS.md "Vented box — `0x456800`",
        // bugs/BUG_20260927_vented-box-losses-not-winisd-form.md). Every loss is a FIXED
        // resistance taken at ωb = 2π·Fb — the box's TUNING, never the vent's own length or
        // area — unlike the branch above, whose Map/Rap are per-frequency and length-derived:
        //   Map = 1/(ωb²·Cab)                 the vent's geometry is not read at all
        //   Ral = Ql/(ωb·Cab)                  leak, parallel to the box (fixed)
        //   Raa = ωb·Map/Qa                    absorption, in series with Cab (fixed)
        //   Rap = ωb·Map/Qp                    port loss, in series with Map (fixed)
        //   Zbox = Ral ∥ (Raa + 1/(jωCab)) ∥ (Rap + jωMap)
        // Radiated output is the Cab branch's own current — cone MINUS leak MINUS port, not
        // cone minus port alone. `P.tlPortModel` is a conventional-branch-only option: WinISD's
        // own port here is always this lumped Map, never a transmission line.
        //
        // `P.Fb` absent poisons every value below with NaN, exactly like an absent `Leff`/`Sp`
        // does in the branch above (engine/params.ts's own doc: this solve divides by its inputs
        // unguarded, and `classifyFinite` is the net that catches it) — never a throw, so the
        // engine keeps its no-throw contract whether or not a domain guard ran in front of it
        // (test/engine/hardening.test.ts "the engine's own net still classifies...").
        const Fb = P.Fb ?? NaN;
        const wb = 2 * Math.PI * Fb;
        const Map = 1 / (wb * wb * Cab);
        const Qp = P.Qp || 100;
        const RalConst = cx(Ql / (wb * Cab), 0);
        const RaaSeries = cx(wb * Map / Qa, 0);
        const RapSeries = cx(wb * Map / Qp, 0);
        const CabBranch = cAdd(RaaSeries, Zc);
        const PortBranch = cAdd(RapSeries, cx(0, w * Map));
        Zbox = cPar(RalConst, CabBranch, PortBranch);
        UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        UP = cMul(UD, cDiv(Zbox, PortBranch));
        U0 = cMul(UD, cDiv(Zbox, CabBranch));
        break;
      }
      default: {
        const _exhaustiveCheck: never = lossMode;
        throw new Error(`Unhandled LossModeValue: ${_exhaustiveCheck}`);
      }
    }

  } else if (box === 'box-passive-radiator') {
    // Passive radiator: mechanical elements referred to acoustical domain
    // https://en.wikipedia.org/wiki/Thiele/Small_parameters#Small_signal_parameters
    // n_pr PRs in parallel → combined acoustic impedance = Zpr_single / n_pr. Map/Cap/Rap are the
    // radiator's own mass/compliance/loss — the same in every lossMode; only the BOX's leak and
    // absorption (Ral/Raa) and how the output is read off Zbox differ below.
    const n_pr = P.prNum || 1;
    const Map = (P.prMmd! + P.prMadd!) / (P.prSd! * P.prSd!);
    const Cap = P.prCms! * P.prSd! * P.prSd!;
    const Rap = (P.prRms || 0) / (P.prSd! * P.prSd!);
    const Zpr_single = cAdd(cAdd(cx(Rap, 0), cx(0, w * Map)), cInv(cx(0, w * Cap)));
    const Zpr = n_pr > 1 ? cScale(Zpr_single, 1 / n_pr) : Zpr_single;
    switch (lossMode) {
      case 'lossless':
      case 'conventional-lossy': {
        // Ral/Raa here are the same per-frequency Ql/Qa/(ω·Cab) the sealed box's own
        // conventional-lossy branch uses; for 'lossless' they are effectively absent because
        // Ql/Qa are then ≥1e6. Output is cone minus radiator (leak not split out).
        Zbox = cPar(Zc, Ral, Raa, Zpr);
        UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        UP = cMul(UD, cDiv(Zbox, Zpr));
        U0 = cSub(UD, UP);
        break;
      }
      case 'winisd-lossy': {
        // WinISD's passive-radiator box (winisd_research/GHIDRA_FINDINGS.md "Passive radiator
        // box — `0x45a960`", bugs/BUG_20260927_passive-radiator-losses-not-winisd-form.md).
        // Leak and absorption are FIXED resistances taken at ωr = 2π·Fr — the box's OWN tuning
        // (the resonance this box and this radiator actually produce together,
        // `PassiveRadiatorBox.systemTuning_hz`), never the radiator's free-air Fs and never
        // per-frequency:
        //   Ral = Ql·ωr·Map          leak, parallel to the box (fixed)
        //   Raa = ωr·Map/Qa          absorption, in series with Cab (fixed)
        //   Zbox = Ral ∥ (Raa + 1/(jωCab)) ∥ Zpr
        // Radiated output is the Cab branch's own current — cone MINUS leak MINUS radiator, not
        // cone minus radiator alone. The box's own Qp is never used for a passive radiator (the
        // radiator's own loss Rap above already carries it, as ωp·Map/Qms_pr when the radiator's
        // own added mass Me = 0 — unverified for Me ≠ 0 or n_pr > 1, GHIDRA_FINDINGS.md same
        // section).
        //
        // `P.Fr` absent poisons every value below with NaN, exactly like an absent `Fb` does in
        // the vented branch above — never a throw (classifyFinite is the net that catches it).
        const Fr = P.Fr ?? NaN;
        const wr = 2 * Math.PI * Fr;
        const RalConst = cx(Ql * wr * Map, 0);
        const RaaSeries = cx(wr * Map / Qa, 0);
        const CabBranch = cAdd(RaaSeries, Zc);
        Zbox = cPar(RalConst, CabBranch, Zpr);
        UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
        UP = cMul(UD, cDiv(Zbox, Zpr));
        U0 = cMul(UD, cDiv(Zbox, CabBranch));
        break;
      }
      default: {
        const _exhaustiveCheck: never = lossMode;
        throw new Error(`Unhandled LossModeValue: ${_exhaustiveCheck}`);
      }
    }

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

  // Electrical input impedance Zel = Ze + Bl²/(Sd²·(ZaD+Zbox)), with the ENTERED BL as WinISD
  // uses it (BUG_20260926_winisd-impedance-uses-entered-bl).
  // https://en.wikipedia.org/wiki/Electrical_characteristics_of_a_dynamic_loudspeaker
  const Zel = cAdd(ZcoilForZel, cDiv(cx(BlPush * BlPush, 0), cMul(cx(Sdt * Sdt, 0), cAdd(ZaD, Zbox))));
  return { U0, UD, UP, Zbox, Zel, ZaD };
}
