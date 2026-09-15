import { solveConsistencyGroup } from './solver.js';
import type { DriverSolverQuantities } from './solverQuantities.js';
import type { VentQuantityName, PrQuantityName, SealedAlignmentQuantityName } from './solver.js';
import type { BoxParamsQuantityName } from './params.js';
import type { SignalQuantityName } from './signal.js';
import type { EnvironmentQuantityName } from './air.js';
import type { SweepResult, MaxCurvesResult } from './types.js';

/** One route to a derivable quantity: the formula, everything it needs, and whatever of that
 *  is still absent. `missing` is empty exactly when the route is usable. */
export interface SolveRoute<Q extends string> {
  readonly formula: string;
  readonly required: readonly Q[];
  readonly missing: readonly Q[];
}

/**
 * One calculation's diagnostic: either a target that could not be derived (naming every route
 * that was tried and what each one is still missing), or a target whose entered value
 * contradicts what the OTHER entered values imply for it.
 */
export type CalculationIssue<Q extends string> =
  | {
      readonly kind: 'missing-dependencies';
      readonly target: Q;
      readonly routes: readonly SolveRoute<Q>[];
    }
  | {
      readonly kind: 'inconsistent-inputs';
      readonly target: Q;
      readonly fields: readonly Q[];
      readonly formula: string;
      readonly expected: number;
      readonly actual: number;
      readonly relative: number;
    };

export type DriverQuantityName = keyof DriverSolverQuantities;
export type DriverIssue = CalculationIssue<DriverQuantityName>;

/** The driver solver's one public result: what could be derived, and what could not be (or
 *  disagrees), together — a caller reads `values`, then `issues` to explain any gap in it,
 *  rather than making two calls that could disagree with each other. */
export interface DriverSolveResult {
  readonly values: DriverSolverQuantities;
  readonly issues: readonly DriverIssue[];
}

/** Every field this module's relations read or predict is numeric — `wiring` is the one
 *  non-numeric driver quantity, and no relation below names it. */
type NumericDriverQuantityName = Exclude<DriverQuantityName, 'wiring'>;

/** Field values by name, SI, as the solver produces them — a concrete, closed dictionary over
 *  the driver's own numeric quantities, never a bare `Record<string, unknown>`. */
type Values = Readonly<Partial<Record<NumericDriverQuantityName, number>>>;

/** One inconsistent-inputs group: every member, and the relation that predicts `target` from
 *  the others. WINISD_SCHEMA.md §4 verbatim; nothing here is a new formula. */
interface Relation {
  readonly formula: string;
  readonly target: NumericDriverQuantityName;
  readonly fields: readonly NumericDriverQuantityName[];
  readonly predict: (v: Values) => number;
}

const TAU = 2 * Math.PI;

const RELATIONS: readonly Readonly<Relation>[] = Object.freeze([
  Object.freeze({ formula: 'Qts = Qes·Qms/(Qes+Qms)', target: 'Qts', fields: Object.freeze(['Qts', 'Qes', 'Qms'] as const),
    predict: (v: Values) => v.Qes! * v.Qms! / (v.Qes! + v.Qms!) }),
  Object.freeze({ formula: 'Fs = 1/(2π·√(Mms·Cms))', target: 'Fs_hz', fields: Object.freeze(['Fs_hz', 'Mms_kg', 'Cms_m_per_N'] as const),
    predict: (v: Values) => 1 / (TAU * Math.sqrt(v.Mms_kg! * v.Cms_m_per_N!)) }),
  Object.freeze({ formula: 'Rms = 2π·Fs·Mms/Qms', target: 'Rms_kg_per_s', fields: Object.freeze(['Rms_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qms'] as const),
    predict: (v: Values) => TAU * v.Fs_hz! * v.Mms_kg! / v.Qms! }),
  Object.freeze({ formula: 'Qes = 2π·Fs·Mms·Re/Bl²', target: 'Qes', fields: Object.freeze(['Qes', 'Fs_hz', 'Mms_kg', 'Re_ohm', 'BL_Tm'] as const),
    predict: (v: Values) => TAU * v.Fs_hz! * v.Mms_kg! * v.Re_ohm! / (v.BL_Tm! * v.BL_Tm!) }),
  Object.freeze({ formula: 'Rme = Bl²/Re', target: 'Rme_kg_per_s', fields: Object.freeze(['Rme_kg_per_s', 'BL_Tm', 'Re_ohm'] as const),
    predict: (v: Values) => v.BL_Tm! * v.BL_Tm! / v.Re_ohm! }),
  Object.freeze({ formula: 'Rme = 2π·Fs·Mms/Qes', target: 'Rme_kg_per_s', fields: Object.freeze(['Rme_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qes'] as const),
    predict: (v: Values) => TAU * v.Fs_hz! * v.Mms_kg! / v.Qes! }),
  Object.freeze({ formula: 'Dd = 2·√(Sd/π)', target: 'Dd_m', fields: Object.freeze(['Dd_m', 'Sd_m2'] as const),
    predict: (v: Values) => 2 * Math.sqrt(v.Sd_m2! / Math.PI) }),
  Object.freeze({ formula: 'Mpow = Bl/√Re', target: 'Mpow_N_per_sqrtW', fields: Object.freeze(['Mpow_N_per_sqrtW', 'BL_Tm', 'Re_ohm'] as const),
    predict: (v: Values) => v.BL_Tm! / Math.sqrt(v.Re_ohm!) }),
  Object.freeze({ formula: 'Mpow = √Rme', target: 'Mpow_N_per_sqrtW', fields: Object.freeze(['Mpow_N_per_sqrtW', 'Rme_kg_per_s'] as const),
    predict: (v: Values) => Math.sqrt(v.Rme_kg_per_s!) }),
  Object.freeze({ formula: 'gamma = Bl/Mms', target: 'gamma_m_per_s2_A', fields: Object.freeze(['gamma_m_per_s2_A', 'BL_Tm', 'Mms_kg'] as const),
    predict: (v: Values) => v.BL_Tm! / v.Mms_kg! }),
  Object.freeze({ formula: 'Vd = Sd·Xmax', target: 'Vd_m3', fields: Object.freeze(['Vd_m3', 'Sd_m2', 'Xmax_m'] as const),
    predict: (v: Values) => v.Sd_m2! * v.Xmax_m! }),
  // ρ/c are the driver's OWN resolved air (`solveConsistencyGroup` always fills `c_m_per_s`/
  // `roo_kg_per_m3` in, per solver.ts), never a fixed reference constant — matching the same
  // air the solve itself used for this exact conversion.
  Object.freeze({ formula: 'Vas = ρ·c²·Sd²·Cms', target: 'Vas_m3', fields: Object.freeze(['Vas_m3', 'Cms_m_per_N', 'Sd_m2', 'roo_kg_per_m3', 'c_m_per_s'] as const),
    predict: (v: Values) => v.roo_kg_per_m3! * v.c_m_per_s! * v.c_m_per_s! * v.Sd_m2! * v.Sd_m2! * v.Cms_m_per_N! }),
]);

/** Every field name any relation above reads, deduplicated — the closed set `Values` covers. */
const RELATION_FIELDS: readonly NumericDriverQuantityName[] = Object.freeze(
  Array.from(new Set(RELATIONS.flatMap(rel => rel.fields))),
);

/**
 * Half the last significant decimal of `v`, taken to 12 significant digits: `0.0355` ⇒
 * 0.00005, `37` ⇒ 0.5. `toExponential(11)` (12 significant digits: one before the point, 11
 * after) is read directly — never round-tripped through `Number(v.toPrecision(12))`, which
 * re-shortens to whatever `toExponential()` with NO argument considers the minimal
 * round-trippable representation of the resulting double (`(0.4).toExponential()` is `"4e-1"`,
 * one significant digit, not twelve) and silently produces a tolerance 11 orders of magnitude
 * too loose for any round-ish stated value. Caught by
 * `test/domain.test.ts`'s "reports an inconsistent-inputs issue when a stated Qts contradicts
 * stated Qes/Qms" once real driver-shaped fixtures (not just already-irrational probe numbers)
 * exercised it.
 */
function halfUlp(v: number): number {
  if (!isFinite(v) || v === 0) return 0;
  const s = v.toExponential(11);
  const [mantissa, exponent] = s.split('e');
  const decimals = (mantissa.split('.')[1] ?? '').length;
  return 0.5 * Math.pow(10, Number(exponent) - decimals);
}

/** A computed field's uncertainty can collapse to zero when the solve is insensitive to every
 *  entered value; this is a representation floor, not a tolerance. */
const FLOAT_NOISE = 1e-9;

/** Only the fields any relation reads, as a closed `Values` bag — never the full solved record
 *  (which also carries `wiring` and everything else no relation names). */
function valuesFrom(r: DriverSolverQuantities): Values {
  const out: Partial<Record<NumericDriverQuantityName, number>> = {};
  for (const field of RELATION_FIELDS) {
    const v = r[field];
    if (typeof v === 'number') out[field] = v;
  }
  return out;
}

/** `base` with `field` set to `value` — the one place a `NumericDriverQuantityName` is written
 *  into a fresh `DriverSolverQuantities`, so every caller shares the same, single assignment
 *  the compiler checks once. */
function withNumericField(
  base: DriverSolverQuantities, field: NumericDriverQuantityName, value: number,
): DriverSolverQuantities {
  const next: DriverSolverQuantities = { ...base };
  next[field] = value;
  return next;
}

/**
 * Every entered value's disagreement with what the OTHER entered values imply for it, beyond
 * their own combined rounding precision — plus, for `Qts`, whether the group can even be
 * solved at all. `entered` is the driver's own stated numerics; a value the solver itself
 * derived is never fed back in as if the human had typed it.
 */
export function checkConsistency(entered: DriverSolverQuantities): DriverIssue[] {
  const resolved = solveConsistencyGroup(entered);

  // Each field's own uncertainty: an ENTERED field carries its literal's own rounding
  // (`halfUlp`); a COMPUTED one starts at the float-representation floor and accumulates
  // however far each entered field's own rounding can move it (below).
  const delta: Partial<Record<NumericDriverQuantityName, number>> = {};
  for (const field of RELATION_FIELDS) {
    const value = resolved[field];
    if (typeof value !== 'number') continue;
    delta[field] = entered[field] != null ? halfUlp(value) : Math.abs(value) * FLOAT_NOISE;
  }
  for (const field of RELATION_FIELDS) {
    const enteredValue = entered[field];
    const ownDelta = delta[field];
    if (typeof enteredValue !== 'number' || !(ownDelta! > 0)) continue;
    const bumped = solveConsistencyGroup(withNumericField(entered, field, enteredValue + ownDelta!));
    for (const other of RELATION_FIELDS) {
      if (entered[other] != null) continue; // only computed fields accumulate movement
      const moved = bumped[other];
      const base = resolved[other];
      if (typeof moved === 'number' && typeof base === 'number') {
        delta[other] = (delta[other] ?? 0) + Math.abs(moved - base);
      }
    }
  }

  const resolvedValues = valuesFrom(resolved);
  const issues: DriverIssue[] = [];
  for (const rel of RELATIONS) {
    if (!rel.fields.every(f => typeof resolvedValues[f] === 'number')) continue;
    const expected = rel.predict(resolvedValues);
    if (!isFinite(expected)) continue;

    let tolerance = delta[rel.target] ?? 0;
    for (const f of rel.fields) {
      const fieldDelta = delta[f];
      if (f === rel.target || !(fieldDelta! > 0)) continue;
      const bumpedValues: Partial<Record<NumericDriverQuantityName, number>> = { ...resolvedValues };
      bumpedValues[f] = resolvedValues[f]! + fieldDelta!;
      const moved = rel.predict(bumpedValues);
      if (isFinite(moved)) tolerance += Math.abs(moved - expected);
    }

    const actual = resolvedValues[rel.target]!;
    const residual = Math.abs(expected - actual);
    if (residual > tolerance) {
      issues.push({
        kind: 'inconsistent-inputs', formula: rel.formula, fields: rel.fields,
        target: rel.target, expected, actual, relative: residual / Math.abs(actual),
      });
    }
  }

  // Qts has no route besides Qes+Qms (WinISD has no third input to this triple) — a driver
  // stating fewer than two of the three cannot solve it, and the caller needs to know exactly
  // which field is missing to unblock it, not just that Qts came back undefined.
  if (typeof resolvedValues.Qts !== 'number') {
    const missing: NumericDriverQuantityName[] = (['Qes', 'Qms'] as const).filter(f => entered[f] == null);
    issues.push({
      kind: 'missing-dependencies',
      target: 'Qts',
      routes: [{ formula: 'Qts = Qes·Qms/(Qes+Qms)', required: ['Qes', 'Qms'], missing }],
    });
  }

  return issues;
}

/** The unified driver calculation: solved values and their issues, from one call over the
 *  same entered input — never two calls a caller could pass different arguments to and get
 *  values and issues that no longer describe the same driver. */
export function solveDriver(entered: DriverSolverQuantities): DriverSolveResult {
  return { values: solveConsistencyGroup(entered), issues: checkConsistency(entered) };
}

/** Every field one `CalculationIssue` names — the target, plus (for `missing-dependencies`)
 *  every field any of its routes requires or is still missing. One generic answer for any
 *  domain's issue union, so a UI or domain caller never re-derives "does this issue name that
 *  field" per channel. */
export function issueFields<Q extends string>(issue: CalculationIssue<Q>): readonly Q[] {
  if (issue.kind === 'inconsistent-inputs') return issue.fields;
  return [issue.target, ...issue.routes.flatMap(r => [...r.required, ...r.missing])];
}

/** The formula text for one issue — the single formula for `inconsistent-inputs`, or every
 *  blocked route's formula joined for `missing-dependencies`, since more than one route can be
 *  the reason a target is unavailable. */
export function issueFormula<Q extends string>(issue: CalculationIssue<Q>): string {
  if (issue.kind === 'inconsistent-inputs') return issue.formula;
  return issue.routes.map(r => r.formula).join('; or ');
}

/**
 * Every named sweep output a prerequisite reference can point at — reused from
 * `SweepResult`/`MaxCurvesResult`'s own field names (never a parallel prose vocabulary such as
 * `'maximum SPL'`), so there is one name per output. A human-facing label is a presentation
 * concern for the UI hook that formats the reference, not a name the engine invents.
 */
export type SweepOutputName =
  | keyof Pick<SweepResult, 'spl' | 'phase' | 'gd' | 'exc' | 'excPR' | 'pv' | 'zmag' | 'zph'>
  | keyof Pick<MaxCurvesResult, 'maxspl' | 'maxpwr'>;

/**
 * An ADVISORY about one sweep output that was computed — `values` is present — but is degraded
 * or unbounded because the named upstream quantities are unstated; NOT a blocker, and NOT a
 * duplicated DQ. The one reachable case (QO143, 2026-09-15): `maxspl`/`maxpwr` are `+Infinity`
 * when neither `Pe_W` nor `Xmax_m` is stated — a correct answer, not a gap, so it must never be
 * reported as an error. Anything that actually BLOCKS a sweep (`values: null`) is never
 * represented here: it is the real `CalculationIssue<Q>` itself, embedded in `SweepIssue` —
 * which is why this shape needs no "blocked vs. unbounded" discriminator: blocked never flows
 * through it. The projection to a message is `packages/ui/src/logic/sweepIssueMessage.ts#driverPrerequisiteMessage`
 * (`level: 'warn'`), distinct from `sweepIssueMessage` (`level: 'error'`).
 */
export interface CalculationPrerequisite<Q extends string> {
  readonly output: SweepOutputName;
  readonly missing: readonly Q[];
}

export type DriverPrerequisite = CalculationPrerequisite<DriverQuantityName>;
export type SealedAlignmentPrerequisite = CalculationPrerequisite<SealedAlignmentQuantityName>;
export type VentPrerequisite = CalculationPrerequisite<VentQuantityName>;
export type PrPrerequisite = CalculationPrerequisite<PrQuantityName>;
export type BoxParamsPrerequisite = CalculationPrerequisite<BoxParamsQuantityName>;
export type SignalPrerequisite = CalculationPrerequisite<SignalQuantityName>;
export type EnvironmentPrerequisite = CalculationPrerequisite<EnvironmentQuantityName>;
/** Configuration (box topology support, circuit model, required simulation option) has no
 *  `CalculationIssue`/values bag of its own (an unsupported topology is a whole-design refusal,
 *  `params.ts#validateParams`, not a field-level DQ) — so there is nothing to derive `keyof`
 *  from, and this is a closed string-literal union instead. */
export type ConfigurationPrerequisite = CalculationPrerequisite<'boxType' | 'circuitModel' | 'simulationOption'>;
