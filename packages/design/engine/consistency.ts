/**
 * Consistency-group detection — DETECTION ONLY, no value this module produces ever reaches a
 * chart, a saved record, or a derived field. It reads the driver's own fields and reports the
 * groups whose members contradict each other.
 *
 * The groups and their relations are WINISD_SCHEMA.md §4 verbatim; nothing here is a new formula.
 * §4 rows NOT covered, and why:
 *   7,21,22      Mcost, Gloss, SPLmaxLF — `solveConsistencyGroup` derives all three, one route
 *                each (winisd_research/SOLVER_GAPS.md §2.4). Of the three only Gloss has a
 *                carried `.wdr` value that could contradict its derivation; whether a stale
 *                carried Gloss is a DQ mark is undecided (ledger QO24), so no relation is
 *                declared for any of them.
 *   15,16,17,18  the SPL / USPL / SPLmax legs of the reference-efficiency chain. Row 14's η₀
 *                core IS covered below (D18) — `efficiencyConstant(c)` derives the constant
 *                from the air in use, and the form is pinned against real WinISD's own saved
 *                `no` (winisd_research scripts/probe_rme_beyma.py, 0.000000%). The SPL legs
 *                stay out until their K-constant handling gets the same treatment.
 *   19           `Xmax = |Hc−Hg|/2` — the solver reads `Hc`/`Hg`; nothing in the app writes
 *                those names (the editor's fields are `hc`/`hag`), so the
 *                group can never be populated.
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

import { referenceEfficiency } from './efficiency.js';
import { solveConsistencyGroup, driverC, driverRho } from './solver.js';
import { QUANTITY_NAMES } from './solverQuantities.js';
import type { SolverQuantities, QuantityName } from './solverQuantities.js';
import { dvolFromDims } from './dvolRelation.js';

/** Field values by name, SI, as the solver produces them. */
type Values = SolverQuantities;

/** One §4 group: every member, and the relation that predicts `target` from the others. */
interface Relation {
  readonly formula: string;
  readonly target: QuantityName;
  readonly fields: readonly (QuantityName)[];
  /** Reads members through `g`, which the caller only supplies once every member of
   *  `fields` has been checked usable — so a formula can never read an absent quantity. */
  readonly predict: (g: (f: QuantityName) => number, q: Values) => number;
}

/**
 * One group whose members contradict each other. `fields` is EVERY member — the mark goes on
 * all of them, never on one nominated field, because no member is more at fault than another.
 */
export interface ConsistencyIssue {
  /** The relation as WINISD_SCHEMA.md §4 states it. */
  readonly formula: string;
  /** Every member of the group. */
  readonly fields: readonly (QuantityName)[];
  /** The member the relation predicts. */
  readonly target: QuantityName;
  /** What the other members imply for `target`, SI. */
  readonly expected: number;
  /** What `target` actually holds, SI. */
  readonly actual: number;
  /** |expected − actual| / |actual| — the size of the disagreement, unit-free. */
  readonly relative: number;
}

const TAU = 2 * Math.PI;

/** The relation table. A FUNCTION, not a module-scoped `const` array: a shared array is mutable
 *  however it is declared, and every caller here wants a fresh read anyway. */
function relations(): readonly Relation[] {
  return [
  // §4 row 1
  { formula: 'Rms = 2π·Fs·Mms/Qms', target: 'Rms_kg_per_s', fields: ['Rms_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qms'],
    predict: (g) => TAU * g('Fs_hz') * g('Mms_kg') / g('Qms') },
  // §4 row 2
  { formula: 'Qes = 2π·Fs·Mms·Re/Bl²', target: 'Qes', fields: ['Qes', 'BL_Tm', 'Fs_hz', 'Mms_kg', 'Re_ohm'],
    predict: (g) => TAU * g('Fs_hz') * g('Mms_kg') * g('Re_ohm') / (g('BL_Tm') * g('BL_Tm')) },
  // §4 row 3
  { formula: 'Rme = Bl²/Re', target: 'Rme_kg_per_s', fields: ['Rme_kg_per_s', 'BL_Tm', 'Re_ohm'],
    predict: (g) => g('BL_Tm') * g('BL_Tm') / g('Re_ohm') },
  // §4 row 4
  { formula: 'Rme = 2π·Fs·Mms/Qes', target: 'Rme_kg_per_s', fields: ['Rme_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qes'],
    predict: (g) => TAU * g('Fs_hz') * g('Mms_kg') / g('Qes') },
  // §4 row 5
  { formula: 'Qts = Qes·Qms/(Qes+Qms)', target: 'Qts', fields: ['Qts', 'Qes', 'Qms'],
    predict: (g) => g('Qes') * g('Qms') / (g('Qes') + g('Qms')) },
  // §4 row 6
  { formula: 'Dd = 2·√(Sd/π)', target: 'Dd_m', fields: ['Dd_m', 'Sd_m2'],
    predict: (g) => 2 * Math.sqrt(g('Sd_m2') / Math.PI) },
  // §4 row 8
  { formula: 'Mpow = Bl/√Re', target: 'Mpow_N_per_sqrtW', fields: ['Mpow_N_per_sqrtW', 'BL_Tm', 'Re_ohm'],
    predict: (g) => g('BL_Tm') / Math.sqrt(g('Re_ohm')) },
  // §4 row 9
  { formula: 'Mpow = √Rme', target: 'Mpow_N_per_sqrtW', fields: ['Mpow_N_per_sqrtW', 'Rme_kg_per_s'],
    predict: (g) => Math.sqrt(g('Rme_kg_per_s')) },
  // §4 row 10 -- `g('roo_kg_per_m3')`/`g('c_m_per_s')` are NOT guaranteed present: `checkConsistency` below calls
  { formula: 'Vas = ρ₀·c²·Sd²·Cms', target: 'Vas_m3', fields: ['Vas_m3', 'Cms_m_per_N', 'Sd_m2'],
    predict: (g, q) => driverRho(q) * driverC(q) * driverC(q) * g('Sd_m2') * g('Sd_m2') * g('Cms_m_per_N') },
  // §4 row 11
  { formula: 'Fs = 1/(2π·√(Mms·Cms))', target: 'Fs_hz', fields: ['Fs_hz', 'Mms_kg', 'Cms_m_per_N'],
    predict: (g) => 1 / (TAU * Math.sqrt(g('Mms_kg') * g('Cms_m_per_N'))) },
  // §4 row 13
  { formula: 'gamma = Bl/Mms', target: 'gamma_m_per_s2_A', fields: ['gamma_m_per_s2_A', 'BL_Tm', 'Mms_kg'],
    predict: (g) => g('BL_Tm') / g('Mms_kg') },
  // §4 row 20
  { formula: 'Vd = Sd·Xmax', target: 'Vd_m3', fields: ['Vd_m3', 'Sd_m2', 'Xmax_m'],
    predict: (g) => g('Sd_m2') * g('Xmax_m') },
  // §4 row 12 (BUG_20260821): EBP against the driver's own Fs/Qes — the same route
  // solver.ts rel 12 derives Fs from (Fs = EBP·Qes), stated in EBP-target form.
  { formula: 'EBP = Fs/Qes', target: 'EBP_hz', fields: ['EBP_hz', 'Fs_hz', 'Qes'],
    predict: (g) => g('Fs_hz') / g('Qes') },
  // §4 rows 14-18's η₀ core (D18): the reference-efficiency route WinISD itself uses —
  // verified against real WinISD's own saved `no` to 0.000000% (winisd_research
  // scripts/probe_rme_beyma.py). `c` resolves the same way row 10 resolves air.
  { formula: 'no = (4π²/c³)·Fs³·Vas/Qes', target: 'no', fields: ['no', 'Fs_hz', 'Vas_m3', 'Qes'],
    predict: (g, q) => referenceEfficiency(g('Fs_hz'), g('Vas_m3'), g('Qes'), driverC(q)) },
  // §4 rel-25 (WINISD_SCHEMA.md §3.10.1): the truncated-cone-plus-cylinder geometry lock.
  // Reuses dvolFromDims's own domain guards (all five inputs positive, Depth > MagDepth) —
  // a degenerate geometry returns null, mapped to NaN so the `isFinite(expected)` check below
  // skips it exactly like any other unpredictable relation, never a junk `expected`.
  { formula: 'DVol = (π/4)·[ (Dd²+Dd·Vcd+Vcd²)·(Depth−MagDepth)/3 + Magnet²·MagDepth ]',
    target: 'DVol_m3', fields: ['DVol_m3', 'Dd_m', 'Vcd_m', 'Depth_m', 'MagDepth_m', 'Magnet_m'],
    predict: (g) => dvolFromDims({ Dd: g('Dd_m'), Vcd: g('Vcd_m'), Depth: g('Depth_m'), MagDepth: g('MagDepth_m'), Magnet: g('Magnet_m') }) ?? NaN },
  // §4 rel-24 (WINISD_SCHEMA.md §3.2): the semi-inductance lock, stated in KLe-target form —
  // the same route solver.ts rel 24 derives KLe by. WinISD itself does NOT check this trio, and
  // we do anyway (John, 2026-08-31: "yes if things dont add up we want the screen to [carry] a
  // mark"), because a relation the solver can COMPUTE is one a record can CONTRADICT, and an
  // unreported contradiction is a driver simulating on numbers that disagree with each other.
  { formula: 'KLe = Le·√(2π·fLe)', target: 'KLe_H_sqrtHz', fields: ['KLe_H_sqrtHz', 'Le_H', 'fLe_hz'],
    predict: (g) => g('Le_H') * Math.sqrt(TAU * g('fLe_hz')) },
  ];
}

/**
 * §4 row 5's three Q members — the ONE source of truth for which fields form the Qts/Qes/Qms
 * group, reused by the Driver ADT's own group-staleness handling (QO13). Never redeclare this
 * list elsewhere.
 */
export const Q_GROUP_FIELDS: readonly string[] = relations().find(r => r.target === 'Qts')!.fields;

/** Is this field one of the Q trio? Asked of the list above, never of a second copy. */
export function isQGroupField(field: string): boolean {
  return Q_GROUP_FIELDS.includes(field);
}

/**
 * True when fewer than two of the Q trio are usable — too few to solve the third (§4 row 5:
 * `Qts = Qes·Qms/(Qes+Qms)` needs two of the three). `usable` decides what counts as a usable
 * value for one member field name; callers supply their own notion of "present" (a positive
 * number, a Cell in `Entered`/`Calculated` state, …) without restating which fields form the
 * group.
 *
 * Two legitimate call sites, not duplicates of each other: this predicate answers the question
 * over a RAW RECORD never run through a solver (e.g. a catalogue/DQ scan); a live `Driver`
 * ADT instead answers it by asking its own solved state — `cell('Qts').state`, which reflects
 * whatever `solveConsistencyGroup` already computed. Neither should be rewritten in terms of
 * the other: one reads un-solved data, the other reads a solve's result.
 */
export function qGroupIsIncomplete(usable: (field: string) => boolean): boolean {
  return Q_GROUP_FIELDS.filter(usable).length < 2;
}

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
  const resolved = solveConsistencyGroup(entered);

  const usable = (x: number | undefined): x is number => typeof x === 'number' && isFinite(x) && x > 0;

  // Entered fields carry their own literal's precision; computed fields start at the float
  // floor and accumulate however far the entered roundings can move them.
  const delta: Partial<Record<QuantityName, number>> = {};
  for (const k of QUANTITY_NAMES) {
    const v = resolved[k];
    if (!usable(v)) continue;
    delta[k] = entered[k] !== undefined ? halfUlp(v) : Math.abs(v) * FLOAT_NOISE;
  }
  for (const k of QUANTITY_NAMES) {
    if (entered[k] === undefined || !(delta[k]! > 0)) continue;
    const bumped = solveConsistencyGroup(
      Object.assign({}, entered, { [k]: entered[k]! + delta[k]! }));
    for (const j of QUANTITY_NAMES) {
      if (entered[j] !== undefined || delta[j] === undefined) continue;
      const b = bumped[j];
      if (usable(b)) delta[j]! += Math.abs(b - resolved[j]!);
    }
  }

  const issues: ConsistencyIssue[] = [];
  for (const rel of relations()) {
    if (!rel.fields.every(f => usable(resolved[f]))) continue;
    const expected = rel.predict(f => resolved[f]!, resolved);
    if (!isFinite(expected)) continue;

    const actual = resolved[rel.target];
    if (!usable(actual)) continue;

    let tolerance = delta[rel.target] ?? 0;
    for (const f of rel.fields) {
      const df = delta[f];
      if (f === rel.target || df === undefined || !(df > 0)) continue;
      const moved = rel.predict(j => (j === f ? resolved[f]! + df : resolved[j]!), resolved);
      if (isFinite(moved)) tolerance += Math.abs(moved - expected);
    }

    const residual = Math.abs(expected - actual);
    if (residual > tolerance) {
      issues.push({ formula: rel.formula, fields: rel.fields, target: rel.target,
                    expected, actual, relative: residual / Math.abs(actual) });
    }
  }
  return issues;
}
