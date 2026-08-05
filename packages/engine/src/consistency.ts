/**
 * Consistency-group detection — DETECTION ONLY, no value this module produces ever reaches a
 * chart, a saved record, or a derived field. It reads the driver's own fields and reports the
 * groups whose members contradict each other.
 *
 * The groups and their relations are WDR_SCHEMA.md §4 verbatim; nothing here is a new formula.
 * §4 rows NOT covered, and why:
 *   7            Mcost — §4 itself gives no formula ("always 0 in practice").
 *   12           EBP — not a driver field; `ebp()` computes it on the way to the screen.
 *   14,15,16,17,18  the η₀ / SPL / USPL / SPLmax reference-efficiency chain, which
 *                `solveConsistencyGroup` deliberately excludes because three disagreeing
 *                constants exist across the codebase. A detector built on an unresolved
 *                constant would report the codebase's own open defect on every driver.
 *   19           `Xmax = |Hc−Hg|/2` — the solver reads `Hc`/`Hg`; nothing in the app writes
 *                those names (the editor's fields are `hc`/`hag`, carried passthrough), so the
 *                group can never be populated.
 *   21,22        Gloss, SPLmaxLF — §4 records the formula as unknown.
 *
 * WHAT COUNTS AS A DISAGREEMENT — precision, not exact equality.
 * Every recorded value is rounded, so a group agreeing to within its members' own rounding is
 * consistent. Each field's uncertainty is half of the last significant decimal of the value AS
 * STORED (`Vas = 0.0355` ⇒ ±0.00005 m³), which is the only precision evidence a record carries.
 * A COMPUTED field has no literal of its own, so its uncertainty is propagated: each entered
 * field is bumped by its own half-ulp, the solve is re-run, and the resulting movement is
 * accumulated. A group is reported only when its residual exceeds the sum of those intervals —
 * i.e. when no rounding of the recorded digits can explain the disagreement.
 */

import { RHO, C } from './constants.js';
import { solveConsistencyGroup } from './driver.js';
import type { DriverRaw } from './types.js';

/** Field values by name, SI, as the solver produces them. */
type Values = Readonly<Record<string, number>>;

/** One §4 group: every member, and the relation that predicts `target` from the others. */
interface Relation {
  readonly formula: string;
  readonly target: string;
  readonly fields: readonly string[];
  readonly predict: (v: Values) => number;
}

/**
 * One group whose members contradict each other. `fields` is EVERY member — the mark goes on
 * all of them, never on one nominated field, because no member is more at fault than another.
 */
export interface ConsistencyIssue {
  /** The relation as WDR_SCHEMA.md §4 states it. */
  readonly formula: string;
  /** Every member of the group. */
  readonly fields: readonly string[];
  /** The member the relation predicts. */
  readonly target: string;
  /** What the other members imply for `target`, SI. */
  readonly expected: number;
  /** What `target` actually holds, SI. */
  readonly actual: number;
  /** |expected − actual| / |actual| — the size of the disagreement, unit-free. */
  readonly relative: number;
}

const TAU = 2 * Math.PI;

const RELATIONS: readonly Relation[] = [
  // §4 row 1
  { formula: 'Rms = 2π·Fs·Mms/Qms', target: 'Rms', fields: ['Rms', 'Fs', 'Mms', 'Qms'],
    predict: v => TAU * v.Fs * v.Mms / v.Qms },
  // §4 row 2
  { formula: 'Qes = 2π·Fs·Mms·Re/Bl²', target: 'Qes', fields: ['Qes', 'Bl', 'Fs', 'Mms', 'Re'],
    predict: v => TAU * v.Fs * v.Mms * v.Re / (v.Bl * v.Bl) },
  // §4 row 3
  { formula: 'Rme = Bl²/Re', target: 'Rme', fields: ['Rme', 'Bl', 'Re'],
    predict: v => v.Bl * v.Bl / v.Re },
  // §4 row 4
  { formula: 'Rme = 2π·Fs·Mms/Qes', target: 'Rme', fields: ['Rme', 'Fs', 'Mms', 'Qes'],
    predict: v => TAU * v.Fs * v.Mms / v.Qes },
  // §4 row 5
  { formula: 'Qts = Qes·Qms/(Qes+Qms)', target: 'Qts', fields: ['Qts', 'Qes', 'Qms'],
    predict: v => v.Qes * v.Qms / (v.Qes + v.Qms) },
  // §4 row 6
  { formula: 'Dd = 2·√(Sd/π)', target: 'Dd', fields: ['Dd', 'Sd'],
    predict: v => 2 * Math.sqrt(v.Sd / Math.PI) },
  // §4 row 8
  { formula: 'Mpow = Bl/√Re', target: 'Mpow', fields: ['Mpow', 'Bl', 'Re'],
    predict: v => v.Bl / Math.sqrt(v.Re) },
  // §4 row 9
  { formula: 'Mpow = √Rme', target: 'Mpow', fields: ['Mpow', 'Rme'],
    predict: v => Math.sqrt(v.Rme) },
  // §4 row 10
  { formula: 'Vas = ρ₀·c²·Sd²·Cms', target: 'Vas', fields: ['Vas', 'Cms', 'Sd'],
    predict: v => RHO * C * C * v.Sd * v.Sd * v.Cms },
  // §4 row 11
  { formula: 'Fs = 1/(2π·√(Mms·Cms))', target: 'Fs', fields: ['Fs', 'Mms', 'Cms'],
    predict: v => 1 / (TAU * Math.sqrt(v.Mms * v.Cms)) },
  // §4 row 13
  { formula: 'gamma = Bl/Mms', target: 'gamma', fields: ['gamma', 'Bl', 'Mms'],
    predict: v => v.Bl / v.Mms },
  // §4 row 20
  { formula: 'Vd = Sd·Xmax', target: 'Vd', fields: ['Vd', 'Sd', 'Xmax'],
    predict: v => v.Sd * v.Xmax },
];

/**
 * Half the last significant decimal of `v` as stored: `0.0355` ⇒ 0.00005, `37` ⇒ 0.5.
 * Rounded to 12 significant digits first, so arithmetic noise from a unit conversion
 * (`30/1000` landing on 0.030000000000000002) does not read as 18 digits of precision.
 */
function halfUlp(v: number): number {
  if (!isFinite(v) || v === 0) return 0;
  const s = Number(v.toPrecision(12)).toExponential();
  const [mantissa, exponent] = s.split('e');
  const decimals = (mantissa.split('.')[1] ?? '').length;
  return 0.5 * Math.pow(10, Number(exponent) - decimals);
}

/**
 * A computed field's uncertainty can collapse to zero when the solve is insensitive to every
 * entered value. Floating-point arithmetic is not exact, so a bare `>` comparison would then
 * report a group that agrees to the last bit. This is a representation floor, not a tolerance.
 */
const FLOAT_NOISE = 1e-9;

/**
 * Every §4 group whose members contradict each other beyond their combined precision.
 * `entered` is the driver's entered numerics only, in engine field names — the same bag the
 * Driver ADT hands `solveConsistencyGroup`.
 */
export function checkConsistency(entered: Values): ConsistencyIssue[] {
  const resolved = solveConsistencyGroup(entered as DriverRaw) as unknown as Record<string, number>;

  const usable = (x: number | undefined): boolean => typeof x === 'number' && isFinite(x) && x > 0;

  // Entered fields carry their own literal's precision; computed fields start at the float
  // floor and accumulate however far the entered roundings can move them.
  const delta: Record<string, number> = {};
  for (const k of Object.keys(resolved)) {
    if (!usable(resolved[k])) continue;
    delta[k] = k in entered ? halfUlp(resolved[k]) : Math.abs(resolved[k]) * FLOAT_NOISE;
  }
  for (const k of Object.keys(entered)) {
    if (!(delta[k] > 0)) continue;
    const bumped = solveConsistencyGroup({ ...entered, [k]: entered[k] + delta[k] } as DriverRaw) as unknown as Record<string, number>;
    for (const j of Object.keys(delta)) {
      if (j in entered) continue;
      if (usable(bumped[j])) delta[j] += Math.abs(bumped[j] - resolved[j]);
    }
  }

  const issues: ConsistencyIssue[] = [];
  for (const rel of RELATIONS) {
    if (!rel.fields.every(f => usable(resolved[f]))) continue;
    const expected = rel.predict(resolved);
    if (!isFinite(expected)) continue;

    let tolerance = delta[rel.target];
    for (const f of rel.fields) {
      if (f === rel.target || !(delta[f] > 0)) continue;
      const moved = rel.predict({ ...resolved, [f]: resolved[f] + delta[f] });
      if (isFinite(moved)) tolerance += Math.abs(moved - expected);
    }

    const actual = resolved[rel.target];
    const residual = Math.abs(expected - actual);
    if (residual > tolerance) {
      issues.push({ formula: rel.formula, fields: rel.fields, target: rel.target,
                    expected, actual, relative: residual / Math.abs(actual) });
    }
  }
  return issues;
}
