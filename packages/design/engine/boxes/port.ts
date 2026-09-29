/**
 * Port acoustic loss/impedance — shared by the vented and 4th-order-bandpass box models
 * (`VentedBox.ts`, `Bandpass4Box.ts`). Lives here rather than in `../circuit.ts` so those box
 * classes can import it without `circuit.ts` depending on `./boxes/` (`circuit.ts` re-exports
 * both names unchanged, so an existing import of `portImpedance`/`portLoss` from `circuit.js`
 * still resolves).
 */
import {solveEnvironment} from '../air.js';
import {cAdd, cDiv, cMul, cScale, cTanh, cx} from '../complex.js';
import type {Complex, SweepParams} from '../types.js';

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
 * WinISD's transmission-line port reactance, (ρc/S)·tan(ωL/c): S the port area, L the physical
 * length that tunes to Fb — the Fb mass's own length ρ·L/S = Map, less the end correction.
 * Fitted to winisd_research runs/vented-w5-tlports (impedance 2e-15;
 * toys/w5_tl_port_model_check.py) and runs/bp4-w5-tlports (the front port);
 * bugs/BUG_20260928_tl-port-model-not-winisd.md.
 */
export function winisdLinePortReactance(w: number, Map: number, Sp: number, endCorrection_m: number, rho: number, c: number): number {
  const L = Map * Sp / rho - endCorrection_m;
  return rho * c / Sp * Math.tan(w * L / c);
}
