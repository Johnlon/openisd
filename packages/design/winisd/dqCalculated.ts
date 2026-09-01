/**
 * `dq_calculated` — the data-quality marks only the CALCULATION can find, computed from a driver's
 * own numbers and attached to the spec entries they are about. `drivers/drivers.md` Part B.
 *
 * TWO PRODUCERS, TWO FIELDS. `dq_scraper` holds what only a scraper can see — parse failures,
 * source disagreement, structure. Here: a value outside physical bounds (`range`), and a group of
 * values that cannot all be true at once (`calc`).
 *
 * ── WHY EVERY STRING HERE IS FIXED, AND WHY IT MAY NOT BE IMPROVED ──────────────────────────
 *
 * A mark we emit is read back by `winisd_tools`, whose `DqMark` model RE-RENDERS the registered
 * template from `rule` + `params` on every load and refuses the record when the stored `detail`
 * differs — "dq mark detail is not the registered template's rendering — free prose is banned"
 * (`scrapers/lib/record_registries.py`). The rule name is checked against `DQ_RULES` the same way.
 * So the templates below are TRANSCRIPTIONS of that registry, down to ρ, ·, ², √, π and the em
 * dash, and the numbers are formatted by Python's own `format(x, 'g')` rules rather than
 * JavaScript's. Rewording a message here does not improve a message; it makes every record
 * carrying it unreadable.
 *
 * Adding a rule is a REVIEWED SCHEMA CHANGE in that registry first, then here. There is no way to
 * introduce one from this side.
 */
import type { ConsistencyIssue } from '../engine/index.js';

/** One data-quality mark, in the shape a record stores. `severity` is `'error'` for every rule
 *  this file can produce: the registry fixes severity per rule, and both `calc` and `range`
 *  policies are `ERROR`. */
export interface DqMarkJson {
  readonly kind: 'calc' | 'range';
  readonly severity: 'error';
  readonly rule: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly detail: string;
}

/** A consistency finding, resolved to record field names: the mark, the entry the relation
 *  PREDICTS, and every entry that took part in it. */
export interface CalcFinding {
  readonly target: string;
  readonly members: readonly string[];
  readonly mark: DqMarkJson;
}

// ── PYTHON'S NUMBER FORMATTING ────────────────────────────────────────────────────────────────

/** `48.0000` → `48`, `0.04970` → `0.0497`. Python's `g` drops a trailing fraction; JavaScript's
 *  own formatters keep it. */
function stripTrailingZeros(digits: string): string {
  return digits.includes('.') ? digits.replace(/\.?0+$/, '') : digits;
}

/**
 * The double's EXACT decimal digits, and the power of ten its leading digit sits at.
 *
 * Exact, via the IEEE-754 bits and `BigInt`, because ROUNDING DIRECTION AT A TIE depends on it.
 * Every JavaScript formatter — `toPrecision`, `toExponential`, `toFixed` — breaks a tie upward,
 * while CPython breaks it to even, so `format(1.8125, '.4g')` is `1.812` in Python and `1.813`
 * from `toExponential(3)`. A `detail` carrying the wrong one is a record `winisd_tools` refuses,
 * and the difference is invisible until a value lands exactly on a half — which the quarters and
 * eighths that come out of real T/S arithmetic do often enough to matter.
 *
 * A binary double is always a finite decimal: `significand · 2^e` is `significand · 5^-e / 10^-e`
 * for negative `e`, so the digits below are the value itself and not an approximation of it.
 */
function exactDigits(x: number): { digits: string; exp: number } {
  const bits = new DataView(new ArrayBuffer(8));
  bits.setFloat64(0, Math.abs(x));
  const high = bits.getUint32(0);
  const low = bits.getUint32(4);
  const biasedExponent = (high >>> 20) & 0x7ff;
  const fraction = (BigInt(high & 0xfffff) << 32n) | BigInt(low);
  // A subnormal has no implicit leading one, and its exponent is the smallest there is.
  const significand = biasedExponent === 0 ? fraction : fraction | (1n << 52n);
  const twoExp = biasedExponent === 0 ? -1074 : biasedExponent - 1075;

  const scaled = twoExp >= 0
    ? significand << BigInt(twoExp)
    : significand * 5n ** BigInt(-twoExp);
  const digits = scaled.toString();
  return { digits, exp: digits.length - 1 - Math.max(0, -twoExp) };
}

/** `digits`/`exp` rounded to `precision` significant digits, HALF TO EVEN. Rounding `999…9` up
 *  carries into a new leading digit, which moves the exponent — `9.999e2` at three digits is
 *  `1.00e3`, not `10.0e2`. */
function roundSignificant(digits: string, exp: number, precision: number):
    { digits: string; exp: number } {
  if (digits.length <= precision) return { digits: digits.padEnd(precision, '0'), exp };

  const kept = digits.slice(0, precision);
  const dropped = digits.slice(precision);
  const half = dropped.charCodeAt(0) - 48;
  const beyondHalf = /[1-9]/.test(dropped.slice(1));
  const lastKept = kept.charCodeAt(precision - 1) - 48;
  if (half < 5 || (half === 5 && !beyondHalf && lastKept % 2 === 0)) return { digits: kept, exp };

  const carried = (BigInt(kept) + 1n).toString();
  return carried.length > precision
    ? { digits: carried.slice(0, precision), exp: exp + 1 }
    : { digits: carried.padStart(precision, '0'), exp };
}

/**
 * `format(x, f'.{precision}g')` as CPython renders it — the exact bytes a `detail` must contain.
 *
 * Three differences from anything JavaScript offers, and getting any of them wrong makes the
 * `detail` string differ from Python's, which the record model then refuses:
 *   - the switch to scientific form happens at `exp < -4`, where `Number.toPrecision` uses -6, so
 *     `1e-5` prints as `1e-05` and not `0.0000100000`;
 *   - the exponent carries a sign and AT LEAST TWO digits — `e-07`, never JavaScript's `e-7`;
 *   - trailing zeros are dropped, so six significant digits of 48 is `48`.
 */
function formatG(x: number, precision: number): string {
  if (x === 0) return '0';
  const exact = exactDigits(x);
  const { digits, exp } = roundSignificant(exact.digits, exact.exp, precision);
  const sign = x < 0 ? '-' : '';

  if (exp < -4 || exp >= precision) {
    const mantissa = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
    return `${sign}${stripTrailingZeros(mantissa)}e${exp < 0 ? '-' : '+'}` +
      String(Math.abs(exp)).padStart(2, '0');
  }
  if (exp >= 0) {
    const whole = digits.slice(0, exp + 1);
    const fraction = digits.slice(exp + 1);
    return sign + stripTrailingZeros(fraction === '' ? whole : `${whole}.${fraction}`);
  }
  return sign + stripTrailingZeros(`0.${'0'.repeat(-exp - 1)}${digits}`);
}

/**
 * `round(x, 1)` as CPython does it: the EXACT value of the double, rounded to one decimal, HALF TO
 * EVEN — `0.25` gives `0.2` and `0.75` gives `0.8`.
 *
 * Exact for the same reason `formatG` is. Scaling by ten first is not good enough: `1115.55` is
 * really `1115.549999…`, and `1115.55 * 10` rounds UP to exactly `11155.5`, manufacturing a tie
 * that the true value never had and turning Python's `1115.5` into `1115.6`.
 */
function roundHalfEven1(x: number): number {
  const { digits, exp } = exactDigits(x);
  const decimals = digits.length - 1 - exp;
  if (decimals <= 1) return x;

  const divisor = 10n ** BigInt(decimals - 1);
  const scaled = BigInt(digits);
  const tenths = scaled / divisor;
  const twiceRemainder = (scaled % divisor) * 2n;
  const roundUp = twiceRemainder > divisor || (twiceRemainder === divisor && tenths % 2n === 1n);
  const rounded = Number(roundUp ? tenths + 1n : tenths) / 10;
  return x < 0 ? -rounded : rounded;
}

/** How far apart the two figures are, as the percentage the registry's templates print.
 *  The COMPUTED value is the denominator — `semantic_dq.py` divides by `expected`, not by the
 *  stored value, and a mark rendered against the other denominator is refused on load. */
function offPct(computed: number, stored: number): number {
  return roundHalfEven1(Math.abs(stored - computed) / Math.abs(computed) * 100);
}

// ── THE RANGE LIMITS ──────────────────────────────────────────────────────────────────────────

/**
 * The physical/simulation sanity bounds on one field's SI value, or `undefined` for a field that
 * asserts none. Transcribed from `SpecField`'s `range_lo`/`range_hi` members in
 * `scrapers/lib/record_registries.py`, which is where the scraper's own range check reads them.
 *
 * A SWITCH, so the bounds are reached by a call and there is no module-scoped binding at all.
 *
 * `VCCon` has bounds in the registry (1..2) and is absent here on purpose: the app holds voice-coil
 * wiring as a `VoiceCoilWiring` NAME, so there is no number on this side to compare, and a value
 * outside 1..2 cannot survive the record seam that turns it into a name.
 */
function rangeLimits(field: string): { readonly lo?: number; readonly hi?: number } | undefined {
  switch (field) {
    case 'Fs': return { lo: 1, hi: 5000 };
    case 'Re': return { lo: 0.1, hi: 64 };
    case 'Le': return { lo: 0, hi: 0.1 };
    case 'fLe': return { lo: 0 };
    case 'KLe': return { lo: 0 };
    case 'Znom': return { lo: 1, hi: 64 };
    case 'Qts': return { lo: 0.01, hi: 5 };
    case 'Qes': return { lo: 0.01, hi: 5 };
    case 'Qms': return { lo: 0.1, hi: 50 };
    case 'Vas': return { lo: 1e-6, hi: 1 };
    case 'Sd': return { lo: 1e-5, hi: 0.3 };
    case 'BL': return { lo: 0.1, hi: 50 };
    case 'Mms': return { lo: 1e-5, hi: 2 };
    case 'Cms': return { lo: 1e-6, hi: 0.1 };
    case 'Rms': return { lo: 0, hi: 200 };
    case 'Xmax': return { lo: 1e-4, hi: 0.15 };
    case 'SPL': return { lo: 50, hi: 150 };
    case 'Pe': return { lo: 1, hi: 20000 };
    case 'Dd': return { lo: 0, hi: 2 };
    case 'EBP': return { lo: 0 };
    case 'numVC': return { lo: 1, hi: 4 };
    case 'Hg': return { lo: 0 };
    case 'Hc': return { lo: 0 };
    default: return undefined;
  }
}

/**
 * The mark for one field's stated value being outside its bounds, or `undefined` when it is inside
 * them, has no bounds, or is zero.
 *
 * ZERO IS SKIPPED, exactly as `semantic_dq.py` skips it. A scraper that failed to read a number
 * frequently yields 0, so a zero is treated as an absent reading rather than a value below every
 * floor — which would otherwise put a range mark on most of the corpus and say nothing.
 */
export function rangeMark(field: string, value: number): DqMarkJson | undefined {
  if (value === 0 || !isFinite(value)) return undefined;
  const limits = rangeLimits(field);
  if (limits === undefined) return undefined;

  if (limits.lo !== undefined && value < limits.lo) {
    return {
      kind: 'range', severity: 'error', rule: 'range-below-min',
      params: { field, value, limit: limits.lo, unit: '' },
      detail: `${field}=${formatG(value, 6)} below min ${formatG(limits.lo, 6)}`,
    };
  }
  if (limits.hi !== undefined && value > limits.hi) {
    return {
      kind: 'range', severity: 'error', rule: 'range-above-max',
      params: { field, value, limit: limits.hi, unit: '' },
      detail: `${field}=${formatG(value, 6)} above max ${formatG(limits.hi, 6)}`,
    };
  }
  return undefined;
}

// ── THE CONSISTENCY FINDINGS ──────────────────────────────────────────────────────────────────

/**
 * The record's own name for one engine quantity — `Fs_hz` → `Fs`, `Cms_m_per_N` → `Cms`.
 *
 * WRITTEN OUT rather than derived by stripping a suffix: `no`, `Qts` and `Gloss` carry no suffix
 * to strip, and a quantity renamed in the engine would silently stop matching a record key instead
 * of failing to compile. The switch is exhaustive over `ConsistencyIssue['target']`, so a new
 * quantity is a build error here.
 *
 * `undefined` names a quantity no record stores: the two TERMINAL values, which are derived from
 * `Re`, `numVC` and the wiring, and `SPLref_dB`, a solver intermediate.
 */
function recordKey(quantity: ConsistencyIssue['target']): string | undefined {
  switch (quantity) {
    case 'Fs_hz': return 'Fs';
    case 'Re_ohm': return 'Re';
    case 'Znom_ohm': return 'Znom';
    case 'Le_H': return 'Le';
    case 'fLe_hz': return 'fLe';
    case 'KLe_H_sqrtHz': return 'KLe';
    case 'Qes': return 'Qes';
    case 'Qms': return 'Qms';
    case 'Qts': return 'Qts';
    case 'Vas_m3': return 'Vas';
    case 'Sd_m2': return 'Sd';
    case 'Dd_m': return 'Dd';
    case 'BL_Tm': return 'BL';
    case 'Mms_kg': return 'Mms';
    case 'Cms_m_per_N': return 'Cms';
    case 'Rms_kg_per_s': return 'Rms';
    case 'EBP_hz': return 'EBP';
    case 'Xmax_m': return 'Xmax';
    case 'Vd_m3': return 'Vd';
    case 'Hc_m': return 'Hc';
    case 'Hg_m': return 'Hg';
    case 'Pe_W': return 'Pe';
    case 'no': return 'no';
    case 'SPL_dB': return 'SPL';
    case 'USPL_dB': return 'USPL';
    case 'SPLmax_dB': return 'SPLmax';
    case 'SPLmaxLF_dB': return 'SPLmaxLF';
    case 'Rme_kg_per_s': return 'Rme';
    case 'Mpow_N_per_sqrtW': return 'Mpow';
    case 'Mcost_kg_per_s': return 'Mcost';
    case 'gamma_m_per_s2_A': return 'gamma';
    case 'Gloss': return 'Gloss';
    case 'Vcd_m': return 'Vcd';
    case 'Depth_m': return 'Depth';
    case 'MagDepth_m': return 'MagDepth';
    case 'Magnet_m': return 'Magnet';
    case 'DVol_m3': return 'DVol';
    case 'c_m_per_s': return 'c';
    case 'roo_kg_per_m3': return 'roo';
    case 'Re_terminal_ohm': return undefined;
    case 'BL_terminal_Tm': return undefined;
    case 'SPLref_dB': return undefined;
  }
}

/** The relation's right-hand side — `Rms = 2π·Fs·Mms/Qms` → `2π·Fs·Mms/Qms`. `calc-consistency`
 *  states the field and its formula separately, so the target's name is not repeated inside it. */
function rightHandSide(formula: string): string {
  const split = formula.indexOf(' = ');
  return split < 0 ? formula : formula.slice(split + 3);
}

/**
 * One engine consistency finding as a record-side mark.
 *
 * `Vas` and `Qts` have DEDICATED rules in the registry, with their formula written into the
 * template; every other relation goes through the generic `calc-consistency`, which carries the
 * field and formula as params. That split is the registry's, not a choice made here — emitting a
 * Vas disagreement as `calc-consistency` would render a different `detail` from the one the
 * scraper's own check produces for the same finding.
 */
export function calcMark(issue: ConsistencyIssue): CalcFinding {
  const target = recordKey(issue.target);
  const members: string[] = [];
  for (const field of issue.fields) {
    const key = recordKey(field);
    if (key !== undefined) members.push(key);
  }

  const computed = issue.expected;
  const stored = issue.actual;
  const off_pct = offPct(computed, stored);
  const numbers = `${formatG(computed, 4)} vs stored ${formatG(stored, 4)} — ${formatG(off_pct, 6)}% apart`;

  if (target === 'Vas') {
    return { target, members, mark: {
      kind: 'calc', severity: 'error', rule: 'vas-consistency',
      params: { computed, stored, off_pct },
      detail: `Vas from ρ·c²·Sd²·Cms = ${numbers}`,
    } };
  }
  if (target === 'Qts') {
    return { target, members, mark: {
      kind: 'calc', severity: 'error', rule: 'qts-consistency',
      params: { computed, stored, off_pct },
      detail: `Qts from Qes·Qms/(Qes+Qms) = ${numbers}`,
    } };
  }

  // A relation whose TARGET no record stores still describes a real disagreement between the
  // members that do. `calc-consistency` needs a field name for its params and its template, so the
  // quantity's engine name is used where there is no record name — it is the only name the finding
  // has, and inventing a record key that does not exist would be worse.
  const field = target ?? issue.target;
  return { target: field, members, mark: {
    kind: 'calc', severity: 'error', rule: 'calc-consistency',
    params: { field, formula: rightHandSide(issue.formula), computed, stored, off_pct },
    detail: `${field} from ${rightHandSide(issue.formula)} = ${numbers}`,
  } };
}

/**
 * Every calculated mark for one device, by the record field it belongs on.
 *
 * `stated` is the value the RECORD ITSELF states for each field, by record key — never a derived
 * one. A range check has nothing to say about a number the calculation produced: if a derived Vas
 * comes out above a cubic metre, the finding is that the inputs disagree, and the consistency
 * check is what reports it.
 *
 * A CONSISTENCY MARK GOES ON EVERY MEMBER OF ITS GROUP, not on the field the relation predicts
 * (John, 2026-09-01). A group is over-specified as a whole — `Qts = Qes·Qms/(Qes+Qms)` failing
 * says the three numbers cannot all be true, and names no culprit — so a reader looking at any one
 * of them has to be told, and marking only the predicted field would leave the other two looking
 * clean.
 */
export function dqCalculated(
  stated: ReadonlyArray<readonly [string, number]>,
  issues: readonly ConsistencyIssue[],
): ReadonlyMap<string, readonly DqMarkJson[]> {
  const byField = new Map<string, DqMarkJson[]>();
  const add = (field: string, found: DqMarkJson): void => {
    const already = byField.get(field);
    if (already === undefined) byField.set(field, [found]);
    else already.push(found);
  };

  // Range first, then consistency — the order `semantic_dq.py` stamps them in, so a field carrying
  // both lists them the same way on both sides.
  for (const [field, value] of stated) {
    const outOfRange = rangeMark(field, value);
    if (outOfRange !== undefined) add(field, outOfRange);
  }
  for (const issue of issues) {
    const finding = calcMark(issue);
    // A COPY PER MEMBER, so every entry states the finding in full. Handing the same object to
    // three entries makes the YAML writer emit it once with an anchor and refer to it by alias
    // everywhere else, and an entry whose whole content is `*a1` carries no legible finding of
    // its own — a corpus file is read by people.
    for (const member of finding.members) {
      add(member, { ...finding.mark, params: { ...finding.mark.params } });
    }
  }
  return byField;
}

// ── ATTACHING THE MARKS ───────────────────────────────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The record with each field's marks written onto that field's spec entry, under `dq_calculated`.
 *
 * A COPY, at every level it touches. The bridge round-trips its generated text against the ORIGINAL
 * parsed object, so mutating a nested entry in place would edit the very thing the round-trip is
 * checking against and make the comparison prove nothing.
 *
 * A field with no findings gets NO KEY — absent, never `[]`. An empty list is a claim that the
 * calculation ran and found nothing, which is a different fact from the calculation not having run.
 */
export function withDqCalculated(
  record: Readonly<Record<string, unknown>>,
  section: string,
  marks: ReadonlyMap<string, readonly DqMarkJson[]>,
): Record<string, unknown> {
  const specs = record.specs;
  if (marks.size === 0 || !isRecord(specs)) return { ...record };

  const sectionEntries = specs[section];
  if (!isRecord(sectionEntries)) return { ...record };

  const markedEntries: Record<string, unknown> = {};
  for (const [field, entry] of Object.entries(sectionEntries)) {
    const found = marks.get(field);
    markedEntries[field] = found === undefined || found.length === 0 || !isRecord(entry)
      ? entry
      : { ...entry, dq_calculated: found };
  }

  return { ...record, specs: { ...specs, [section]: markedEntries } };
}
