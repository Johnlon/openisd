/**
 * Port acoustic loss/impedance — shared by the vented and 4th-order-bandpass box models
 * (`VentedBox.ts`, `Bandpass4Box.ts`). Lives here rather than in `../circuit.ts` so those box
 * classes can import it without `circuit.ts` depending on `./boxes/` (`circuit.ts` re-exports
 * both names unchanged, so an existing import of `portImpedance`/`portLoss` from `circuit.js`
 * still resolves).
 */
import {cAdd, cDiv, cInv, cMul, cPar, cScale, cTanh, cx} from '../complex.js';
import type {Complex, SweepParams} from '../types.js';
import {DEFAULT_NEW_PROJECT_QP} from '../../fields/defaults.js';
import {airCompliance} from '../air.js';

/** A chamber of `V_m3` vented to `f_Hz`, as the lossless band-pass models (`Bandpass6Box.ts`, `AbcBox.ts`) build each chamber:
 *  its compliance Cab = V/(rho c^2), the tuning w0 = 2 pi f, the port mass Map = 1/(w0^2 Cab) that tunes it there, and the
 *  port branch Rap + j w Map with Rap = w0 Map / Qp. */
export function tunedChamber(V_m3: number, f_Hz: number, rho: number, c: number, w: number, Qp: number): {Cab: number; w0: number; Map: number; Zport: Complex} {
  const Cab = airCompliance(V_m3, rho, c);
  const w0 = 2 * Math.PI * f_Hz;
  const Map = 1 / (w0 * w0 * Cab);
  return {Cab, w0, Map, Zport: cAdd(cx(w0 * Map / Qp, 0), cx(0, w * Map))};
}

/** One chamber of a WinISD band-pass box in the `winisd-lossy` form (winisd_research/archive/GHIDRA_FINDINGS.md, 4th- and
 *  6th-order bandpass and ABC): compliance `Cab`, vented to `f_Hz` through a port of area `Sp`, with WinISD's fixed losses
 *  at that tuning. The front chamber of `Bandpass4Box` and both chambers of `Bandpass6Box` and `AbcBox`.
 *    w0 = 2 pi f   Map = 1/(w0^2 Cab)   Ral = Ql w0 Map   Raa = w0 Map/Qa   Rap = w0 Map/Qp
 *    Zc = Raa + 1/jwCab   RapBranch = Rap + j(port reactance: w Map, or the transmission-line form)   Z = Ral || Zc || RapBranch */
export function winisdLossyVentedChamber(Cab: number, f_Hz: number, Ql: number, Qa: number, Qp: number, Sp: number, endCorrection_m: number | undefined,
  P: Pick<SweepParams, 'tlPortModel' | 'winisdTlPortNoEndCorrection'>, w: number, rho: number, c: number): {Z: Complex; Zc: Complex; Ral: Complex; RapBranch: Complex} {
  const w0 = 2 * Math.PI * f_Hz;
  const Map = 1 / (w0 * w0 * Cab);
  const Ral = cx(Ql * w0 * Map, 0);
  const Raa = cx(w0 * Map / Qa, 0);
  const Zc = cAdd(Raa, cInv(cx(0, w * Cab)));
  const RapBranch = cAdd(cx(w0 * Map / Qp, 0), cx(0, P.tlPortModel ? winisdLinePortReactance(w, Map, Sp, droppedEndCorrection_m(endCorrection_m, P.winisdTlPortNoEndCorrection), rho, c) : w * Map));
  return {Z: cPar(Ral, Zc, RapBranch), Zc, Ral, RapBranch};
}

/** The inter-chamber leak of a WinISD band-pass box: Ricl = Qiclfr ws Mas at the driver's own ws = 1/sqrt(Mas Cas). */
export function interChamberLeak(Qiclfr: number, Mas: number, Cas: number): Complex {
  const ws = 1 / Math.sqrt(Mas * Cas);
  return cx(Qiclfr * ws * Mas, 0);
}

/** Both chambers of WinISD's 6th-order band-pass and ABC boxes in the `winisd-lossy` form, rear (Vb, Fr) and front (Vf, Ff),
 *  each a `winisdLossyVentedChamber`, and the `interChamberLeak`. `Bandpass6Box` and `AbcBox` differ only in how they join
 *  them. Absent Q, tuning or port fields give NaN (`?? NaN`), caught by `classifyFinite`, never a throw. */
export function winisdLossyChambers(P: SweepParams, w: number, Cas: number, Mas: number, rho: number, c: number): {Zr: Complex; Zcr: Complex; RapBranchR: Complex; Zf: Complex; Zcf: Complex; RapBranchF: Complex; Ricl: Complex} {
  const rear = winisdLossyVentedChamber(airCompliance(P.Vb, rho, c), P.Fr ?? NaN, P.Qlr ?? NaN, P.Qar ?? NaN, P.Qpr ?? NaN, P.Spr ?? NaN, P.rearPortEndCorrection_m, P, w, rho, c);
  const front = winisdLossyVentedChamber(airCompliance(P.Vf ?? NaN, rho, c), P.Ff ?? NaN, P.Qlf ?? NaN, P.Qaf ?? NaN, P.Qpf ?? NaN, P.Sp ?? NaN, P.portEndCorrection_m, P, w, rho, c);
  return {Zr: rear.Z, Zcr: rear.Zc, RapBranchR: rear.RapBranch, Zf: front.Z, Zcf: front.Zc, RapBranchF: front.RapBranch, Ricl: interChamberLeak(P.Qiclfr ?? NaN, Mas, Cas)};
}

/** The load of two chambers in series behind the cone with the inter-chamber leak across them (4th- and 6th-order
 *  band-pass, `winisd-lossy`): Zbox = Ricl || (Zr + Zf), the cone's volume velocity UD = pg/(ZaE + ZaD + Zbox), and the
 *  part Ul = UD Zbox/(Zr + Zf) that flows through the chambers rather than the leak. */
export function seriesChambersWithLeak(Zr: Complex, Zf: Complex, Ricl: Complex, pg: Complex, ZaE: Complex, ZaD: Complex): {Zbox: Complex; UD: Complex; Ul: Complex} {
  const ZrPlusZf = cAdd(Zr, Zf);
  const Zbox = cPar(Ricl, ZrPlusZf);
  const UD = cDiv(pg, cAdd(cAdd(ZaE, ZaD), Zbox));
  return {Zbox, UD, Ul: cMul(UD, cDiv(Zbox, ZrPlusZf))};
}

export function portLoss(w: number, Map: number, P: Pick<SweepParams, 'Qp'>): number {
  return w * Map / (P.Qp || DEFAULT_NEW_PROJECT_QP);
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
  const rho = P.air.rho(), c = P.air.c();

  const Map = rho * Leff / Sp, Rap = portLoss(w, Map, P);
  if (!P.tlPortModel) return cAdd(cx(Rap, 0), cx(0, w * Map));
  const k    = w / c;
  const Z0   = rho * c / Sp;
  const a    = Math.sqrt(Sp / Math.PI);              // equivalent piston radius
  const Zrad = cx(Z0 * 0.25 * (k * a) * (k * a), 0); // resistive radiation load at the mouth
  const th   = cTanh(cx(k * Leff / (P.Qp || DEFAULT_NEW_PROJECT_QP), k * Leff));
  const num  = cAdd(Zrad, cScale(th, Z0));
  const den  = cAdd(cx(Z0, 0), cMul(Zrad, th));
  return cScale(cDiv(num, den), Z0);
}

/**
 * WinISD's transmission-line port reactance, (ρc/S)·tan(ωL/c): S the port area, L the physical
 * length that tunes to Fb — the Fb mass's own length ρ·L/S = Map, less the end correction.
 * Fitted to winisd_research runs/vented-w5-tlports (impedance 2e-15;
 * toys/w5_tl_port_model_check.py) and runs/bp4-w5-tlports (the front port);
 * bugs/archive/BUG_20260928_tl-port-model-not-winisd.md.
 */
export function winisdLinePortReactance(w: number, Map: number, Sp: number, endCorrection_m: number, rho: number, c: number): number {
  const L = Map * Sp / rho - endCorrection_m;
  return rho * c / Sp * Math.tan(w * L / c);
}

/**
 * The end correction the transmission-line port pipe drops: WinISD's own pipe is Map·S/ρ less the
 * end correction, so the box tunes above Fb (`winisdTlPortNoEndCorrection` on); with it off the
 * pipe keeps the end correction, is Map·S/ρ long and tunes at Fb.
 */
export function droppedEndCorrection_m(endCorrection_m: number | undefined, winisdTlPortNoEndCorrection: boolean | undefined): number {
  return winisdTlPortNoEndCorrection === true ? endCorrection_m ?? NaN : 0;
}
