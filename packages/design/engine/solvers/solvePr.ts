import type {Air} from '../air.js';
import {prFsWithMass, prMassForFp, prTuning} from '../boxDesign.js';
import type {PrSolverParams} from '../solverTypes.js';
import {inconsistentInputs, missingDependencies, targetUnreachable} from '../consistency.js';
import type {CalculationIssue, TargetUnreachableIssue} from '../consistency.js';

export type PrQuantityName = keyof PrSolverParams;
export type PrIssue = CalculationIssue<PrQuantityName> | TargetUnreachableIssue;

// `solvePrConsistencyGroup` (a p:PrWorkingSet,air:Air->PrWorkingSet twin of `solvePr` below) was
// deleted: it had zero callers. `solvePr` is the only PR solve route reachable from `Engine`, and
// `testSolver.ts`'s exported `solvePrConsistencyGroup` is a same-named but unrelated helper that
// calls `engine.solvePr` — it does not reach this module's private function.

/** The PR geometry every route below needs, beside `tuning_goal_hz`/`addedMass_kg` themselves —
 *  named once so both routes report the identical missing set. */
const PR_GEOMETRY: readonly PrQuantityName[] = Object.freeze(['Vb_m3', 'prMmd_kg', 'prSd_m2', 'prCms_m_per_N']);

/** The PR handle solve (T10/T11): derive whichever of `tuning_goal_hz`/`addedMass_kg` is not entered
 *  plus `resonanceWithAddedMass_hz`/`systemTuning_hz`, write each onto its `SolverField` via
 *  `setCalculated`, and return the issues the stated values carry. An entered value is never
 *  overwritten; an underivable member becomes `not-available`. `air` is the project's own
 *  resolved `{ rho, c }` — see `vent/VentEngine.ts`. */
export function solvePr(params: PrSolverParams, air: Air): PrIssue[] {
  const addedMass = params.addedMass_kg.value;
  const tuning = params.tuning_goal_hz.value;
  const Vb = params.Vb_m3.value;
  const prMmd = params.prMmd_kg.value;
  const prSd = params.prSd_m2.value;
  const prCms = params.prCms_m_per_N.value;

  const issues: PrIssue[] = [];

  if (tuning != null && tuning <= 0) {
    issues.push(inconsistentInputs('tuning_goal_hz', ['tuning_goal_hz'],
      'Tuning frequency must be greater than zero', 0, tuning, 1));
  }

  const geometryComplete = Vb != null && Vb > 0 && prMmd != null && prSd != null && prCms != null;
  const missingGeometry = PR_GEOMETRY.filter(f => { const v = params[f].value; return !(typeof v === 'number' && v > 0); });

  if (addedMass != null && !params.tuning_goal_hz.entered) {
    if (geometryComplete) {
      params.tuning_goal_hz.setCalculated(prTuning({ Vb, prMmd, prMadd: addedMass, prSd, prCms }, air));
    } else {
      params.tuning_goal_hz.setNotAvailable();
      // geometryComplete is false here, and every way it can be false — Vb null/≤0, or prMmd/
      // prSd/prCms null — is also a way PR_GEOMETRY's own >0 filter counts that same field, so
      // missingGeometry is never empty in this branch.
      issues.push(missingDependencies('tuning_goal_hz',
        [{ formula: 'tuning_goal_hz from addedMass_kg + Vb_m3 + prMmd_kg + prSd_m2 + prCms_m_per_N',
          required: ['addedMass_kg', ...PR_GEOMETRY], missing: missingGeometry }]));
    }
  } else if (tuning != null && !params.addedMass_kg.entered) {
    if (geometryComplete && tuning > 0) {
      const totalMass = prMassForFp({ Vb, prMmd, prMadd: 0, prSd, prCms }, tuning, air);
      const addedMassResult = totalMass - prMmd;
      if (addedMassResult >= 0) {
        params.addedMass_kg.setCalculated(addedMassResult);
      } else {
        params.addedMass_kg.setNotAvailable();
        issues.push(targetUnreachable('addedMass_kg',
          prTuning({ Vb, prMmd, prMadd: 0, prSd, prCms }, air)));
      }
    } else {
      params.addedMass_kg.setNotAvailable();
      issues.push(missingDependencies('addedMass_kg',
        [{ formula: 'addedMass_kg from tuning_goal_hz + Vb_m3 + prMmd_kg + prSd_m2 + prCms_m_per_N',
          required: ['tuning_goal_hz', ...PR_GEOMETRY], missing: missingGeometry }]));
    }
  }

  const resolvedMass = params.addedMass_kg.value;
  if (resolvedMass != null && prMmd != null && prCms != null) {
    params.resonanceWithAddedMass_hz.setCalculated(prFsWithMass(prMmd, resolvedMass, prCms));
  } else {
    params.resonanceWithAddedMass_hz.setNotAvailable();
  }
  if (resolvedMass != null && Vb != null && Vb > 0 && prMmd != null && prSd != null && prCms != null) {
    params.systemTuning_hz.setCalculated(prTuning({ Vb, prMmd, prMadd: resolvedMass, prSd, prCms }, air));
  } else {
    params.systemTuning_hz.setNotAvailable();
  }

  return issues;
}
