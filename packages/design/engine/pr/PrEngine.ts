/**
 * The passive-radiator area of the engine: the radiator's own closed-form quantities (Vas, Fs
 * with added mass, Qms and their inverses), the system tuning it gives a box, the added mass
 * that reaches a target tuning, and the handle solve that fills in whichever of
 * tuning/added-mass the project has not entered.
 */
import type {Air} from '../air.js';
import type {RouteGroup} from '../driver/routes/index.js';
import {solveEnvironment} from '../air.js';
import type {PrParams} from '../types.js';
import type {PrSolverParams} from '../solverTypes.js';
import {inconsistentInputs, missingDependencies, targetUnreachable} from '../consistency.js';
import type {CalculationIssue, TargetUnreachableIssue} from '../consistency.js';

export type PrQuantityName = keyof PrSolverParams;
export type PrIssue = CalculationIssue<PrQuantityName> | TargetUnreachableIssue;

/** A radiator's stated figures: the WinISD set (Fs, Qms, Vas, Sd) and the mechanical set
 *  (Mms, Cms, Rms) a record may also carry. */
export interface PrSpecValues {
  readonly Fs_hz: number | null;
  readonly Qms: number | null;
  readonly Vas_m3: number | null;
  readonly Sd_m2: number | null;
  readonly Mms_kg: number | null;
  readonly Cms_m_per_N: number | null;
  readonly Rms_kg_per_s: number | null;
}

/** `air` where taken is the PROJECT's own resolved `{ rho, c }` — see `vent/VentEngine.ts`.
 *  `vas`/`cmsFromVas` take none: no environment reaches their call sites, so ρ/c are the
 *  reference environment's, computed live — never a stored constant. */
export interface PrEngine {
  /** System resonance with `prNum` radiators in parallel: PR compliance `Cap = prCms·prSd²`,
   *  `Cpar = Cab·N·Cap/(Cab+N·Cap)`, `fp = 1/(2π·√((Map/N)·Cpar))` — the Fb WinISD displays.
   *  https://en.wikipedia.org/wiki/Helmholtz_resonance#Resonant_frequency */
  tuning(p: PrParams, air: Air): number;
  /** Moving mass per radiator that tunes the box to `fp` — the inverse of `tuning`:
   *  `Map = N/((2π·fp)²·Cpar)`, `Mmp = Map·prSd²`. */
  massForFp(p: PrParams, fp: number, air: Air): number;
  /** Compliance-equivalent volume, cubic metres: `Vas = Cms·Sd²·ρ·c²`. */
  vas(prCms: number, prSd: number): number;
  /** Compliance from Vas (cubic metres) and Sd — the inverse of `vas`. 0 when Sd ≤ 0. */
  cmsFromVas(prVas_m3: number, prSd: number): number;
  /** Free-air resonance loaded with added cone mass: `1/(2π·√((Mmd+Madd)·Cms))` — the
   *  radiator alone, no box. 0 when the total mass or compliance is non-positive. */
  fsWithMass(prMmd: number, prMadd: number, prCms: number): number;
  /** Moving mass from free-air Fs and compliance — the inverse of `fsWithMass` with no added
   *  mass. 0 when Fs or Cms is non-positive. */
  mmdFromFs(prFsHz: number, prCms: number): number;
  /** Mechanical Q: `√(Mmd/Cms)/Rms`. 0 when Rms ≤ 0. */
  qms(prMmd: number, prCms: number, prRms: number): number;
  /** Mechanical resistance from Qms — the inverse of `qms`. 0 when Qms ≤ 0. */
  rmsFromQms(prQmsValue: number, prMmd: number, prCms: number): number;
  /** The radiator's seven stated figures run through the driver's consistency relations, in
   *  the project's `air`: every figure derivable from the stated ones comes back with them, a
   *  stated one unchanged, an underivable one null. Pass only what was entered. */
  solveSpec(stated: PrSpecValues, air: Air): PrSpecValues;
  /** The PR handle solve (T10/T11): derive whichever of `tuning_goal_hz`/`addedMass_kg` is not
   *  entered plus `resonanceWithAddedMass_hz`/`systemTuning_hz`, write each onto its
   *  `SolverField` via `setCalculated`, and return the issues the stated values carry. An
   *  entered value is never overwritten; an underivable member becomes `not-available`. */
  solve(params: PrSolverParams, air: Air): PrIssue[];
}

/** The PR geometry every solve route needs, beside `tuning_goal_hz`/`addedMass_kg` themselves —
 *  named once so both routes report the identical missing set. */
const PR_GEOMETRY: readonly PrQuantityName[] = Object.freeze(['Vb_m3', 'prMmd_kg', 'prSd_m2', 'prCms_m_per_N']);

export class PrEngineImpl implements PrEngine {
  constructor(private readonly routes: RouteGroup) {}

  tuning(p: PrParams, air: Air): number {
    const Cab  = p.Vb / (air.rho * air.c * air.c);
    const Map  = (p.prMmd + p.prMadd) / (p.prSd * p.prSd);
    const Cap  = p.prNum * p.prCms * p.prSd * p.prSd;
    const Cpar = (Cab * Cap) / (Cab + Cap);
    return 1 / (2 * Math.PI * Math.sqrt(Map / p.prNum * Cpar));
  }

  massForFp(p: PrParams, fp: number, air: Air): number {
    const Cab  = p.Vb / (air.rho * air.c * air.c);
    const Cap  = p.prNum * p.prCms * p.prSd * p.prSd;
    const Cpar = (Cab * Cap) / (Cab + Cap);
    const Map  = p.prNum / ((2 * Math.PI * fp) ** 2 * Cpar);
    return Map * p.prSd * p.prSd;
  }

  vas(prCms: number, prSd: number): number {
    const {rho, c} = solveEnvironment({}).values;
    return prCms * prSd * prSd * rho * c * c;
  }

  cmsFromVas(prVas_m3: number, prSd: number): number {
    if (!(prSd > 0)) return 0;
    const {rho, c} = solveEnvironment({}).values;
    return prVas_m3 / (prSd * prSd * rho * c * c);
  }

  fsWithMass(prMmd: number, prMadd: number, prCms: number): number {
    const m = prMmd + prMadd;
    return m > 0 && prCms > 0 ? 1 / (2 * Math.PI * Math.sqrt(m * prCms)) : 0;
  }

  mmdFromFs(prFsHz: number, prCms: number): number {
    return prFsHz > 0 && prCms > 0 ? 1 / ((2 * Math.PI * prFsHz) ** 2 * prCms) : 0;
  }

  qms(prMmd: number, prCms: number, prRms: number): number {
    return prRms > 0 ? Math.sqrt(prMmd / prCms) / prRms : 0;
  }

  rmsFromQms(prQmsValue: number, prMmd: number, prCms: number): number {
    return prQmsValue > 0 ? Math.sqrt(prMmd / prCms) / prQmsValue : 0;
  }

  solveSpec(stated: PrSpecValues, air: Air): PrSpecValues {
    const orUndefined = (x: number | null): number | undefined => x ?? undefined;
    const solved = this.routes.run({
      Fs_hz: orUndefined(stated.Fs_hz), Qms: orUndefined(stated.Qms), Vas_m3: orUndefined(stated.Vas_m3),
      Sd_m2: orUndefined(stated.Sd_m2), Mms_kg: orUndefined(stated.Mms_kg),
      Cms_m_per_N: orUndefined(stated.Cms_m_per_N), Rms_kg_per_s: orUndefined(stated.Rms_kg_per_s),
      c_m_per_s: air.c, roo_kg_per_m3: air.rho,
    });
    return {
      Fs_hz: solved.Fs_hz ?? null, Qms: solved.Qms ?? null, Vas_m3: solved.Vas_m3 ?? null, Sd_m2: solved.Sd_m2 ?? null,
      Mms_kg: solved.Mms_kg ?? null, Cms_m_per_N: solved.Cms_m_per_N ?? null, Rms_kg_per_s: solved.Rms_kg_per_s ?? null,
    };
  }

  solve(params: PrSolverParams, air: Air): PrIssue[] {
    const addedMass = params.addedMass_kg.value;
    const tuning = params.tuning_goal_hz.value;
    const Vb = params.Vb_m3.value;
    const prMmd = params.prMmd_kg.value;
    const prSd = params.prSd_m2.value;
    const prCms = params.prCms_m_per_N.value;
    const prNum = params.prNum.value || 1;

    const issues: PrIssue[] = [];

    if (tuning != null && tuning <= 0) {
      issues.push(inconsistentInputs('tuning_goal_hz', ['tuning_goal_hz'],
        'Tuning frequency must be greater than zero', 0, tuning, 1));
    }

    const geometryComplete = Vb != null && Vb > 0 && prMmd != null && prSd != null && prCms != null;
    const missingGeometry = PR_GEOMETRY.filter(f => { const v = params[f].value; return !(typeof v === 'number' && v > 0); });

    if (addedMass != null && !params.tuning_goal_hz.entered) {
      if (geometryComplete) {
        params.tuning_goal_hz.setCalculated(this.tuning({ Vb, prMmd, prMadd: addedMass, prSd, prCms, prNum }, air));
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
        const totalMass = this.massForFp({ Vb, prMmd, prMadd: 0, prSd, prCms, prNum }, tuning, air);
        const addedMassResult = totalMass - prMmd;
        if (addedMassResult >= 0) {
          params.addedMass_kg.setCalculated(addedMassResult);
        } else {
          params.addedMass_kg.setNotAvailable();
          issues.push(targetUnreachable('addedMass_kg',
            this.tuning({ Vb, prMmd, prMadd: 0, prSd, prCms, prNum }, air)));
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
      params.resonanceWithAddedMass_hz.setCalculated(this.fsWithMass(prMmd, resolvedMass, prCms));
    } else {
      params.resonanceWithAddedMass_hz.setNotAvailable();
    }
    if (resolvedMass != null && Vb != null && Vb > 0 && prMmd != null && prSd != null && prCms != null) {
      params.systemTuning_hz.setCalculated(this.tuning({ Vb, prMmd, prMadd: resolvedMass, prSd, prCms, prNum }, air));
    } else {
      params.systemTuning_hz.setNotAvailable();
    }

    return issues;
  }
}
