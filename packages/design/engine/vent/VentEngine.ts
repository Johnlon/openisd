/**
 * The vent area of the engine: a port's length for a target tuning, the tuning a port of a
 * given length produces, its acoustic (effective) length, and the handle solve that fills in
 * whichever of tuning/length the project has not entered. Helmholtz throughout:
 * https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency
 */
import type {Air} from '../air.js';
import {END_CORRECTION} from '../air.js';
import type {VentSolverParams} from '../solverTypes.js';
import {inconsistentInputs, missingDependencies, targetUnreachable} from '../consistency.js';
import type {CalculationIssue, TargetUnreachableIssue} from '../consistency.js';

export type VentQuantityName = keyof VentSolverParams;
export type VentIssue = CalculationIssue<VentQuantityName> | TargetUnreachableIssue;

/** `air` on every method is the PROJECT's own resolved `{ rho, c }` — never a
 *  reference-condition default computed inside the engine. The caller (ultimately `OpenISDBox`,
 *  via its embedded driver's already-resolved air — Driver Air Constants,
 *  `docs/plans/PLAN_DRIVER_SOLVE_AND_SWEEP_DIAGNOSTICS.md`) decides what air a design runs in.
 *
 *  `Sp` is ONE port's area and `count` how many identical ports there are: the air-mass term
 *  sees the total opening `count·Sp`, while the end correction is a per-port effect and keeps
 *  the single port's equivalent diameter `d = 2·√(Sp/π)`. */
export interface VentEngine {
  /** Port length for a target tuning: `f = (c/2π)·√(A / (V₀·L_eq))`, `L_eq = L + endCorrection·d`.
   *
   *  The result is the RAW SIGNED root, never clamped. The end correction alone already supplies
   *  acoustic mass, so every volume + port area has a ceiling — the tuning at L = 0 — above
   *  which the equation's only solution is a negative length. That negative IS the answer: it
   *  says the target is unreachable and by how much, it round-trips exactly through
   *  `tuningFromLength`, and callers guard on `> 0`. Flooring it would return a buildable-looking
   *  vent that tunes somewhere else entirely. */
  lengthForTuning(Vb: number, fb: number, Sp: number, count: number, air: Air, endCorrection?: number): number;
  /** The tuning a port of that length produces — the inverse of `lengthForTuning`. Both
   *  directions exist because the user may enter either, and the other is then solved. */
  tuningFromLength(Vb: number, L: number, Sp: number, count: number, air: Air, endCorrection?: number): number;
  /** A port's ACOUSTIC length — the physical length plus the end correction, which is what the
   *  sweep's port model actually resonates (`SweepParams.Leff`).
   *
   *  Takes the port's AREA, not its shape, and derives the equivalent diameter from it —
   *  `2·√(Sp/π)`. Exact for a round port and the standard equivalent-diameter substitution for
   *  a slotted one, so the end correction applies to both with no shape argument.
   *
   *  `count` is taken so every port call states the same geometry, but the end correction is a
   *  PER-PORT effect: the answer does not change with the number of identical ports. */
  effectiveLength(length_m: number, Sp: number, count: number, endCorrection: number): number;
  /** The vent handle solve (T10/T11): derive whichever of `tuning_goal_hz`/`length_m` is not
   *  entered, write it onto its `SolverField` via `setCalculated`, and return the issues the
   *  stated values carry. An entered value is never overwritten; an underivable member becomes
   *  `not-available`. */
  solve(params: VentSolverParams, air: Air): VentIssue[];
  /** The vent tube's own first (organ-pipe) resonance — the open-open duct fundamental
   *  `c/(2·L)`. Uses the PHYSICAL length, NOT the end-corrected `Leff` (`effectiveLength`), to
   *  match WinISD's own "1st port resonance" readout exactly. `null` for a non-positive length —
   *  there is no port to resonate. */
  firstResonance_hz(length_m: number, air: Air): number | null;
}

/** The vent geometry every route below needs, beside `tuning_goal_hz`/`length_m` themselves. */
const VENT_GEOMETRY: readonly VentQuantityName[] = Object.freeze(['Vb_m3', 'area_m2']);

export class VentEngineImpl implements VentEngine {
  lengthForTuning(Vb: number, fb: number, Sp: number, count: number, air: Air, endCorrection: number = END_CORRECTION): number {
    const Cab = Vb / (air.rho * air.c * air.c);
    const wb  = 2 * Math.PI * fb;
    const Map = 1 / (wb * wb * Cab);
    const d   = 2 * Math.sqrt(Sp / Math.PI);
    return Map * count * Sp / air.rho - endCorrection * d;
  }

  tuningFromLength(Vb: number, L: number, Sp: number, count: number, air: Air, endCorrection: number = END_CORRECTION): number {
    const d    = 2 * Math.sqrt(Sp / Math.PI);
    const Leff = L + endCorrection * d;
    const Cab  = Vb / (air.rho * air.c * air.c);
    const Map  = air.rho * Leff / (count * Sp);
    return 1 / (2 * Math.PI * Math.sqrt(Map * Cab));
  }

  effectiveLength(length_m: number, Sp: number, count: number, endCorrection: number): number {
    void count;
    return length_m + endCorrection * 2 * Math.sqrt(Sp / Math.PI);
  }

  firstResonance_hz(length_m: number, air: Air): number | null {
    return length_m > 0 ? air.c / (2 * length_m) : null;
  }

  solve(params: VentSolverParams, air: Air): VentIssue[] {
    const tuning = params.tuning_goal_hz.value;
    const length = params.length_m.value;
    const Vb = params.Vb_m3.value;
    const area = params.area_m2.value;
    const count = params.count.value ?? 1;
    const endCorrection = params.endCorrection_m.value ?? 0.732;

    const issues: VentIssue[] = [];

    if (tuning != null && tuning <= 0) {
      issues.push(inconsistentInputs('tuning_goal_hz', ['tuning_goal_hz'],
        'Tuning frequency must be greater than zero', 0, tuning, 1));
    }

    const geometryComplete = Vb != null && Vb > 0 && area != null && area > 0;
    const missingGeometry = VENT_GEOMETRY.filter(f => { const v = params[f].value; return !(typeof v === 'number' && v > 0); });

    if (tuning != null && !params.length_m.entered) {
      if (geometryComplete && tuning > 0) {
        const L = this.lengthForTuning(Vb, tuning, area, count, air, endCorrection);
        if (L >= 0) {
          params.length_m.setCalculated(L);
        } else {
          params.length_m.setNotAvailable();
          issues.push(targetUnreachable('length_m',
            this.tuningFromLength(Vb, 0, area, count, air, endCorrection)));
        }
      } else {
        params.length_m.setNotAvailable();
        // geometryComplete is false here, and every way it can be false — Vb or area null/≤0 —
        // is also a way VENT_GEOMETRY's own >0 filter counts that same field, so missingGeometry
        // is never empty in this branch.
        issues.push(missingDependencies('length_m',
          [{ formula: 'length_m from tuning_goal_hz + Vb_m3 + area_m2 (Helmholtz)',
            required: ['tuning_goal_hz', ...VENT_GEOMETRY], missing: missingGeometry }]));
      }
    } else if (length != null && !params.tuning_goal_hz.entered) {
      if (geometryComplete) {
        params.tuning_goal_hz.setCalculated(this.tuningFromLength(Vb, length, area, count, air, endCorrection));
      } else {
        params.tuning_goal_hz.setNotAvailable();
        issues.push(missingDependencies('tuning_goal_hz',
          [{ formula: 'tuning_goal_hz from length_m + Vb_m3 + area_m2 (Helmholtz)',
            required: ['length_m', ...VENT_GEOMETRY], missing: missingGeometry }]));
      }
    }

    return issues;
  }
}
