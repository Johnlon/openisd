/**
 * The passive-radiator area of the engine: the radiator's own closed-form quantities (Vas, Fs
 * with added mass, Qms and their inverses), the system tuning it gives a box, the added mass
 * that reaches a target tuning, and the handle solve that fills in whichever of
 * tuning/added-mass the project has not entered.
 */
import type {Air, AirWorkingName} from '../air.js';
import type {ConsistencyCheck, RouteFormulas, RouteGroup, RouteQuantity} from '../driver/routes/index.js';
import {RADIATOR_ROUTE_FORMULAS} from '../driver/routes/index.js';
import type {DriverWorkingSet} from '../solvers/driverQuantities.js';
import type {PrParams} from '../types.js';
import type {PrSolverParams} from '../solverTypes.js';
import {isPositiveGeometry, missingDependencies, targetUnreachable, tuningGoalIssue} from '../consistency.js';
import type {CalculationIssue, TargetUnreachableIssue} from '../consistency.js';

export type PrQuantityName = keyof PrSolverParams | AirWorkingName;
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

/** Each stated figure's own half-width: the reading's stated precision, or half the last decimal
 *  it was typed to; 0 for a figure not stated. */
export type PrSpecPrecision = Readonly<Record<keyof PrSpecValues, number>>;

/** A stated radiator figure that contradicts the relation tying it to the others. */
export type PrSpecIssue = CalculationIssue<RouteQuantity>;

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
  vas(prCms: number, prSd: number, air: Air): number;
  /** Compliance from Vas (cubic metres) and Sd — the inverse of `vas`. 0 when Sd ≤ 0. */
  cmsFromVas(prVas_m3: number, prSd: number, air: Air): number;
  /** Free-air resonance loaded with added cone mass: `1/(2π·√((Mmd+Madd)·Cms))` — the
   *  radiator alone, no box. 0 when the total mass or compliance is non-positive. */
  fsWithMass(prMmd: number, prMadd: number, prCms: number): number;
  /** Moving mass from free-air Fs and compliance — the inverse of `fsWithMass` with no added
   *  mass. 0 when Fs or Cms is non-positive. */
  mmdFromFs(prFsHz: number, prCms: number): number;
  /** Displacement, cubic metres: `Vd = Sd·Xmax`. Null without a positive Sd and Xmax. */
  displacement(prSd_m2: number | null, prXmax_m: number | null): number | null;
  /** The "2×" rule of thumb as a count of this radiator: the smallest whole N with `N·prVd ≥ 2·nDrivers·driverVd`. Null
   *  without a positive displacement for both. */
  countForTwiceDisplacement(prVd_m3: number | null, driverVd_m3: number | null, nDrivers: number): number | null;
  /** What the "2×" rule asks of the radiators: `2·nDrivers·driverVd`. Null without a positive driver displacement. */
  twiceDriverDisplacement(driverVd_m3: number | null, nDrivers: number): number | null;
  /** The Xmax of the starting placeholder radiator: enough that `prCount` radiators of `prSd_m2` meet the "2×" rule
   *  (`prCount·prSd·Xmax = 2·nDrivers·driverVd`, `countForTwiceDisplacement` then gives at most `prCount`), and never less
   *  than twice one driver's Xmax (a radiator has no motor, so it needs more excursion than the driver; John, 2026-09-29).
   *  Null without a positive driver Xmax and displacement, radiator Sd and count. */
  placeholderRadiatorXmax(driverXmax_m: number | null, driverVd_m3: number | null, nDrivers: number, prSd_m2: number | null,
    prCount: number): number | null;
  /** Mechanical Q: `√(Mmd/Cms)/Rms`. 0 when Rms ≤ 0. */
  qms(prMmd: number, prCms: number, prRms: number): number;
  /** Mechanical resistance from Qms — the inverse of `qms`. 0 when Qms ≤ 0. */
  rmsFromQms(prQmsValue: number, prMmd: number, prCms: number): number;
  /** The radiator's seven stated figures run through the driver's consistency relations, in
   *  the project's `air`: every figure derivable from the stated ones comes back with them, a
   *  stated one unchanged, an underivable one null. Pass only what was entered. */
  solveSpec(stated: PrSpecValues, air: Air): PrSpecValues;
  /** Where the stated figures contradict each other: the driver's consistency relations among
   *  Fs, Qms, Vas, Sd, Mms, Cms and Rms, in the project's `air`, each figure judged against its
   *  own `precision`. Pass only what was entered. Every issue names every field in its relation.
   *  Also the first of Cms, Mms, Rms the simulation needs and the stated figures cannot give, as
   *  a `missing-dependencies` issue naming what to state. */
  checkSpec(stated: PrSpecValues, precision: PrSpecPrecision, air: Air): PrSpecIssue[];
  /** The PR handle solve (T10/T11): derive whichever of `tuning_goal_hz`/`addedMass_kg` is not
   *  entered plus `resonanceWithAddedMass_hz`/`systemTuning_hz`, write each onto its
   *  `SolverField` via `setCalculated`, and return the issues the stated values carry. An
   *  entered value is never overwritten; an underivable member becomes `not-available`. With `air`
   *  not available, a value that needs it stays `not-available` and its issue names `c_m_per_s`
   *  and `roo_kg_per_m3`. */
  solve(params: PrSolverParams, air: Air): PrIssue[];
  /** The formulas `solveSpec` works a radiator's figures out by: one per route among its own figures, with its text and
   *  inputs, in the order it tries them. The radiator editor's formula panel shows these (T902). */
  routeFormulas(): RouteFormulas;
}

/** The starting placeholder radiator's least excursion, in multiples of one driver's Xmax (John, 2026-09-29). */
const PLACEHOLDER_RADIATOR_XMAX_MULTIPLE = 2;

/** The PR geometry every solve route needs, beside `tuning_goal_hz`/`addedMass_kg` themselves —
 *  named once so both routes report the identical missing set. */
const PR_GEOMETRY: readonly (keyof PrSolverParams)[] = Object.freeze(['Vb_m3', 'prMmd_kg', 'prSd_m2', 'prCms_m_per_N']);

export class PrEngineImpl implements PrEngine {
  displacement(prSd_m2: number | null, prXmax_m: number | null): number | null {
    if (prSd_m2 === null || prXmax_m === null || !(prSd_m2 > 0) || !(prXmax_m > 0)) return null;
    return prSd_m2 * prXmax_m;
  }

  twiceDriverDisplacement(driverVd_m3: number | null, nDrivers: number): number | null {
    if (driverVd_m3 === null || !(driverVd_m3 > 0) || !(nDrivers > 0)) return null;
    return 2 * nDrivers * driverVd_m3;
  }

  routeFormulas(): RouteFormulas {
    return RADIATOR_ROUTE_FORMULAS;
  }

  placeholderRadiatorXmax(driverXmax_m: number | null, driverVd_m3: number | null, nDrivers: number, prSd_m2: number | null,
    prCount: number): number | null {
    const required = this.twiceDriverDisplacement(driverVd_m3, nDrivers);
    if (required === null || driverXmax_m === null || prSd_m2 === null || !(driverXmax_m > 0) || !(prSd_m2 > 0) || !(prCount > 0)) return null;
    return Math.max(PLACEHOLDER_RADIATOR_XMAX_MULTIPLE * driverXmax_m, required / (prSd_m2 * prCount));
  }

  countForTwiceDisplacement(prVd_m3: number | null, driverVd_m3: number | null, nDrivers: number): number | null {
    if (prVd_m3 === null || driverVd_m3 === null || !(prVd_m3 > 0) || !(driverVd_m3 > 0) || !(nDrivers > 0)) return null;
    // A relative tolerance keeps an exact fit (200 against 2 × 100) from rounding up on floating-point noise.
    return Math.max(1, Math.ceil(2 * nDrivers * driverVd_m3 / prVd_m3 - 1e-9));
  }

  constructor(
    private readonly routes: RouteGroup,
    private readonly consistency: ConsistencyCheck,
  ) {}

  tuning(p: PrParams, air: Air): number {
    const Cab  = p.Vb / (air.rho() * air.c() * air.c());
    const Map  = (p.prMmd + p.prMadd) / (p.prSd * p.prSd);
    const Cap  = p.prNum * p.prCms * p.prSd * p.prSd;
    const Cpar = (Cab * Cap) / (Cab + Cap);
    return 1 / (2 * Math.PI * Math.sqrt(Map / p.prNum * Cpar));
  }

  massForFp(p: PrParams, fp: number, air: Air): number {
    const Cab  = p.Vb / (air.rho() * air.c() * air.c());
    const Cap  = p.prNum * p.prCms * p.prSd * p.prSd;
    const Cpar = (Cab * Cap) / (Cab + Cap);
    const Map  = p.prNum / ((2 * Math.PI * fp) ** 2 * Cpar);
    return Map * p.prSd * p.prSd;
  }

  vas(prCms: number, prSd: number, air: Air): number {
    return prCms * prSd * prSd * air.rho() * air.c() * air.c();
  }

  cmsFromVas(prVas_m3: number, prSd: number, air: Air): number {
    if (!(prSd > 0)) return 0;
    return prVas_m3 / (prSd * prSd * air.rho() * air.c() * air.c());
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
    const solved = this.routes.run(this.workingSet(stated), air);
    return {
      Fs_hz: solved.Fs_hz ?? null, Qms: solved.Qms ?? null, Vas_m3: solved.Vas_m3 ?? null, Sd_m2: solved.Sd_m2 ?? null,
      Mms_kg: solved.Mms_kg ?? null, Cms_m_per_N: solved.Cms_m_per_N ?? null, Rms_kg_per_s: solved.Rms_kg_per_s ?? null,
    };
  }

  checkSpec(stated: PrSpecValues, precision: PrSpecPrecision, air: Air): PrSpecIssue[] {
    const widths: Partial<Record<RouteQuantity, number>> = {
      Fs_hz: precision.Fs_hz, Qms: precision.Qms, Vas_m3: precision.Vas_m3, Sd_m2: precision.Sd_m2,
      Mms_kg: precision.Mms_kg, Cms_m_per_N: precision.Cms_m_per_N, Rms_kg_per_s: precision.Rms_kg_per_s,
    };
    const conflicts = this.consistency.check(
      this.workingSet(stated), working => this.routes.run(working, air), field => widths[field] ?? 0);
    const missing = this.firstMissing(this.solveSpec(stated, air));
    return missing === null ? conflicts : [...conflicts, missing];
  }

  /** The first of the three mechanical figures the simulation needs (Cms, then Mms, then Rms)
   *  that the stated ones cannot give, as the route that would give it and what that route still
   *  lacks. Only the first: a missing Cms is why Mms and Rms are missing too, and one ⚠ naming
   *  the root is what the user can act on. Null when all three are known. */
  private firstMissing(solved: PrSpecValues): PrSpecIssue | null {
    const lacking = (fields: readonly (keyof PrSpecValues)[]): (keyof PrSpecValues)[] => fields.filter(f => solved[f] === null);
    if (solved.Cms_m_per_N === null) {
      return missingDependencies<RouteQuantity>('Cms_m_per_N',
        [{formula: 'Cms = Vas/(ρ·c²·Sd²)', required: ['Vas_m3', 'Sd_m2'], missing: lacking(['Vas_m3', 'Sd_m2'])}]);
    }
    if (solved.Mms_kg === null) {
      return missingDependencies<RouteQuantity>('Mms_kg',
        [{formula: 'Mms = 1/((2π·Fs)²·Cms)', required: ['Fs_hz', 'Cms_m_per_N'], missing: lacking(['Fs_hz'])}]);
    }
    if (solved.Rms_kg_per_s === null) {
      return missingDependencies<RouteQuantity>('Rms_kg_per_s',
        [{formula: 'Rms = √(Mms/Cms)/Qms', required: ['Qms', 'Mms_kg', 'Cms_m_per_N'], missing: lacking(['Qms'])}],
        'Until then the charts take the radiator as lossless.');
    }
    return null;
  }

  /** The stated figures as the routes read them; `routes.run` adds the air. */
  private workingSet(stated: PrSpecValues): DriverWorkingSet {
    const orUndefined = (x: number | null): number | undefined => x ?? undefined;
    return {
      Fs_hz: orUndefined(stated.Fs_hz), Qms: orUndefined(stated.Qms), Vas_m3: orUndefined(stated.Vas_m3),
      Sd_m2: orUndefined(stated.Sd_m2), Mms_kg: orUndefined(stated.Mms_kg),
      Cms_m_per_N: orUndefined(stated.Cms_m_per_N), Rms_kg_per_s: orUndefined(stated.Rms_kg_per_s),
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

    const goalIssue = tuningGoalIssue(tuning);
    if (goalIssue !== null) issues.push(goalIssue);

    // The geometry needs Vb, Mmd, Sd and Cms all above 0 (T930): a zero Sd or Cms is not geometry,
    // and tuning from it is NaN or Infinity, the same rule PR_GEOMETRY's own filter applies below.
    const geometryComplete = isPositiveGeometry(Vb) && isPositiveGeometry(prMmd) && isPositiveGeometry(prSd) && isPositiveGeometry(prCms);
    const missingGeometry = PR_GEOMETRY.filter(f => !isPositiveGeometry(params[f].value));

    if (addedMass != null && !params.tuning_goal_hz.entered) {
      if (geometryComplete) {
        params.tuning_goal_hz.setCalculated(this.tuning({ Vb, prMmd, prMadd: addedMass, prSd, prCms, prNum }, air));
      } else {
        params.tuning_goal_hz.setNotAvailable();
        // Either the geometry is incomplete, and every way it can be — Vb null/≤0, or prMmd/prSd/
        // prCms null — is also a way PR_GEOMETRY's own >0 filter counts that same field, or the
        // air is not available.
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
    if (resolvedMass != null && isPositiveGeometry(prMmd) && isPositiveGeometry(prCms)) {
      params.resonanceWithAddedMass_hz.setCalculated(this.fsWithMass(prMmd, resolvedMass, prCms));
    } else {
      params.resonanceWithAddedMass_hz.setNotAvailable();
    }
    if (resolvedMass != null && geometryComplete) {
      params.systemTuning_hz.setCalculated(this.tuning({ Vb, prMmd, prMadd: resolvedMass, prSd, prCms, prNum }, air));
    } else {
      params.systemTuning_hz.setNotAvailable();
    }

    return issues;
  }
}
