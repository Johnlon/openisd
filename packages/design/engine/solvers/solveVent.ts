import type {Air} from '../air.js';
import {tuningFromLength, ventLength} from '../boxDesign.js';
import type {VentSolverParams} from '../solverTypes.js';
import type {CalculationIssue, TargetUnreachableIssue} from '../consistency.js';

export type VentQuantityName = keyof VentSolverParams;
export type VentIssue = CalculationIssue<VentQuantityName> | TargetUnreachableIssue;

// `solveVentConsistencyGroup` (a p:VentWorkingSet,air:Air->VentWorkingSet twin of `solveVent`
// below) was deleted: it had zero callers. `solveVent` is the only vent solve route reachable
// from `Engine`, and `testSolver.ts`'s exported `solveVentConsistencyGroup` is a same-named but
// unrelated helper that calls `engine.solveVent` — it does not reach this module's private
// function.

/** The vent geometry every route below needs, beside `tuning_goal_hz`/`length_m` themselves. */
const VENT_GEOMETRY: readonly VentQuantityName[] = Object.freeze(['Vb_m3', 'area_m2']);

/** The vent handle solve (T10/T11): derive whichever of `tuning_goal_hz`/`length_m` is not entered,
 *  write it onto its `SolverField` via `setCalculated`, and return the issues the stated
 *  values carry. An entered value is never overwritten; an underivable member becomes
 *  `not-available`. `air` is the project's own resolved `{ rho, c }` — see
 *  `boxDesign.ts#ventLength`'s doc comment for why that is a parameter here, never a
 *  reference-condition default. */
export function solveVent(params: VentSolverParams, air: Air): VentIssue[] {
  const tuning = params.tuning_goal_hz.value;
  const length = params.length_m.value;
  const Vb = params.Vb_m3.value;
  const area = params.area_m2.value;
  const count = params.count.value ?? 1;
  const endCorrection = params.endCorrection_m.value ?? 0.732;

  const issues: VentIssue[] = [];

  if (tuning != null && tuning <= 0) {
    issues.push({
      kind: 'inconsistent-inputs',
      formula: 'Tuning frequency must be greater than zero',
      fields: ['tuning_goal_hz'],
      target: 'tuning_goal_hz',
      expected: 0,
      actual: tuning,
      relative: 1,
    });
  }

  const geometryComplete = Vb != null && Vb > 0 && area != null && area > 0;
  const missingGeometry = VENT_GEOMETRY.filter(f => { const v = params[f].value; return !(typeof v === 'number' && v > 0); });

  if (tuning != null && !params.length_m.entered) {
    if (geometryComplete && tuning > 0) {
      const L = ventLength(Vb, tuning, area, count, air, endCorrection);
      if (L >= 0) {
        params.length_m.setCalculated(L);
      } else {
        params.length_m.setNotAvailable();
        issues.push({
          kind: 'target-unreachable',
          target: 'length_m',
          maxReachable_hz: tuningFromLength(Vb, 0, area, count, air, endCorrection),
        });
      }
    } else {
      params.length_m.setNotAvailable();
      // geometryComplete is false here, and every way it can be false — Vb or area null/≤0 —
      // is also a way VENT_GEOMETRY's own >0 filter counts that same field, so missingGeometry
      // is never empty in this branch.
      issues.push({
        kind: 'missing-dependencies', target: 'length_m',
        routes: [{ formula: 'length_m from tuning_goal_hz + Vb_m3 + area_m2 (Helmholtz)',
          required: ['tuning_goal_hz', ...VENT_GEOMETRY], missing: missingGeometry }],
      });
    }
  } else if (length != null && !params.tuning_goal_hz.entered) {
    if (geometryComplete) {
      params.tuning_goal_hz.setCalculated(tuningFromLength(Vb, length, area, count, air, endCorrection));
    } else {
      params.tuning_goal_hz.setNotAvailable();
      issues.push({
        kind: 'missing-dependencies', target: 'tuning_goal_hz',
        routes: [{ formula: 'tuning_goal_hz from length_m + Vb_m3 + area_m2 (Helmholtz)',
          required: ['length_m', ...VENT_GEOMETRY], missing: missingGeometry }],
      });
    }
  }

  return issues;
}
