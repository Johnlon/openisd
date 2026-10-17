/**
 * The air solver: works out the open ones of the five air quantities (temperature, humidity,
 * pressure, c, ρ) from the entered ones, through two relations —
 *
 *   sound   c = f(T, RH, p)   the WinISD air model (`soundSpeedAt`)
 *   density ρ = γ·p/c²        closed form, invertible for any one of p, c, ρ
 *
 * Any relation with exactly one open quantity solves it (density in closed form, sound by
 * bracketed bisection: c rises with T and RH and falls with p). Open pressure and c together,
 * with T, RH and ρ entered, are solved in pressure alone. A relation whose quantities are all
 * known and was not used to solve anything is a consistency check, by the same rule as
 * `ConsistencyCheck`: each value carries a half-width (entered: its typed precision; solved: the
 * widths of its inputs carried through), and the stated values disagree only when the gap exceeds
 * the target's own width plus how far every other input's width moves the prediction.
 *
 * A quantity the entered values do not determine is `null` with an issue naming the relation's
 * fields, never a wild number: no root inside the field's limits, a c so coarse that every value
 * in the range matches it, or nothing yet solvable.
 */
import {NumberField} from '../../fields/field.js';
import {GAMMA, soundSpeedAt, temperatureIssues} from '../air.js';
import {inconsistentInputs, missingDependencies} from '../consistency.js';
import type {CalculationIssue} from '../consistency.js';

export type AirQuantityName = 'tempK' | 'humidityPct' | 'pressurePa' | 'c' | 'rho';
export type AirIssue = CalculationIssue<AirQuantityName>;

/** One air quantity as the caller states it: typed, with the half-width (SI) that typing states,
 *  or open to be calculated. */
export type AirInput =
  | {readonly kind: 'entered'; readonly value: number; readonly precision: number}
  | {readonly kind: 'open'};

export interface AirInputs {
  readonly tempK: AirInput;
  readonly humidityPct: AirInput;
  readonly pressurePa: AirInput;
  readonly c: AirInput;
  readonly rho: AirInput;
}

/** Each quantity's value, entered or solved; `null` where it could not be determined. */
export interface AirSolvedValues {
  readonly tempK: number | null;
  readonly humidityPct: number | null;
  readonly pressurePa: number | null;
  readonly c: number | null;
  readonly rho: number | null;
}

export interface AirSolution {
  readonly values: AirSolvedValues;
  readonly issues: readonly AirIssue[];
}

type Known = ReadonlyMap<AirQuantityName, number>;
type Outcome = {readonly kind: 'solved'; readonly value: number} | {readonly kind: 'failed'; readonly why: string};

const QUANTITIES: readonly AirQuantityName[] = Object.freeze<AirQuantityName[]>(['tempK', 'humidityPct', 'pressurePa', 'c', 'rho']);

/** The band each quantity may take: the Advanced-pane fields' own limits, so the solver and the
 *  inputs cannot disagree about what is possible. */
const LIMITS: Readonly<Record<AirQuantityName, {readonly min: number; readonly max: number}>> = Object.freeze<Record<AirQuantityName, {readonly min: number; readonly max: number}>>({
  tempK: NumberField.ADV_TEMP_K.limits,
  humidityPct: NumberField.ADV_HUMIDITY_PCT.limits,
  pressurePa: NumberField.ADV_PRESSURE_KPA.limits,
  c: NumberField.ADV_SOUNDVELOCITY_M_PER_S.limits,
  rho: NumberField.ADV_AIRDENSITY_KG_PER_M3.limits,
});

function solved(value: number): Outcome { return {kind: 'solved', value}; }
function failed(why: string): Outcome { return {kind: 'failed', why}; }

/** The root of `g` in [lo, hi] by bisection to the last double, or null when `g` does not change
 *  sign there (or is NaN at an end). */
function bisect(g: (x: number) => number, lo: number, hi: number): number | null {
  let gLo = g(lo);
  const gHi = g(hi);
  if (Number.isNaN(gLo) || Number.isNaN(gHi)) return null;
  if (gLo === 0) return lo;
  if (gHi === 0) return hi;
  if (Math.sign(gLo) === Math.sign(gHi)) return null;
  let a = lo, b = hi;
  for (;;) {
    const mid = a + (b - a) / 2;
    if (mid <= a || mid >= b) return mid;
    const gMid = g(mid);
    if (gMid === 0) return mid;
    if (Math.sign(gMid) === Math.sign(gLo)) { a = mid; gLo = gMid; } else { b = mid; }
  }
}

/** c at three conditions. Where the moist-air molar mass reaches zero (a very humid, very low
 *  pressure corner) c grows without bound and the model gives NaN: that is +Infinity here, which
 *  keeps c monotonic across the whole limits band so the bracket still works. */
function soundSpeed(t: number, rh: number, p: number): number {
  const c = soundSpeedAt(t, rh, p);
  return Number.isNaN(c) ? Infinity : c;
}

function need(known: Known, name: AirQuantityName): number {
  const v = known.get(name);
  if (v === undefined) throw new Error(`air solver: ${name} is not known`);
  return v;
}

type FieldSolver = (known: Known, widths: Known) => Outcome;

/** The one relation field still open, solved: its outcome, and the same solve over other values
 *  (to carry the inputs' half-widths through). */
interface RelationStep {
  readonly target: AirQuantityName;
  readonly outcome: Outcome;
  again(known: Known): Outcome;
}

/** What the loop and the checks need of a relation, whatever its fields. */
interface AirRelation {
  readonly formula: string;
  readonly fields: readonly AirQuantityName[];
  /** The one field a conflict is reported against: the one `predict` calculates. */
  readonly target: AirQuantityName;
  predict(known: Known): number;
  /** Solves the relation's single open field, if exactly one is open and not given up on. */
  solveOpen(known: Known, widths: Known, gaveUp: ReadonlySet<AirQuantityName>): RelationStep | null;
}

/** A relation over exactly the fields `F`: the compiler requires a solver for every one of them,
 *  and none for a field the relation lacks. */
class FieldRelation<F extends AirQuantityName> implements AirRelation {
  constructor(
    readonly formula: string,
    readonly fields: readonly F[],
    readonly target: F,
    readonly predict: (known: Known) => number,
    private readonly solvers: {readonly [K in F]: FieldSolver},
  ) {}

  solveOpen(known: Known, widths: Known, gaveUp: ReadonlySet<AirQuantityName>): RelationStep | null {
    const open = this.fields.filter(f => !known.has(f));
    const target = open[0];
    if (open.length !== 1 || target === undefined || gaveUp.has(target)) return null;
    const solver = this.solvers[target];
    return {target, outcome: solver(known, widths), again: k => solver(k, widths)};
  }
}

function densityResult(v: number): Outcome {
  return Number.isFinite(v) ? solved(v) : failed('the density relation gives no number');
}

/** Solves one of T, RH, p from a typed c, given `at`: c as a function of that quantity. */
function soundBracket(
  at: (x: number) => number, limits: {readonly min: number; readonly max: number},
  known: Known, widths: Known,
): Outcome {
  const c = need(known, 'c');
  const width = widths.get('c') ?? 0;
  const {min, max} = limits;
  const cMin = at(min), cMax = at(max);
  // Every value in the range matches the typed c within its precision: it pins nothing.
  if (width > 0 && Math.abs(cMin - c) <= width && Math.abs(cMax - c) <= width) {
    return failed('c is not typed finely enough to pin it');
  }
  // A c just past the end of the range, within its own precision, is the end itself.
  const lowEnd = cMin <= cMax ? min : max, highEnd = cMin <= cMax ? max : min;
  const cLow = Math.min(cMin, cMax), cHigh = Math.max(cMin, cMax);
  if (c < cLow) return cLow - c <= width ? solved(lowEnd) : failed('no value in range gives this c');
  if (c > cHigh) return c - cHigh <= width ? solved(highEnd) : failed('no value in range gives this c');
  const root = bisect(x => at(x) - c, min, max);
  return root === null ? failed('no value in range gives this c') : solved(root);
}

const DENSITY: AirRelation = Object.freeze(new FieldRelation<'pressurePa' | 'c' | 'rho'>(
  'ρ = γ·p/c², γ = 1.4',
  ['pressurePa', 'c', 'rho'],
  'rho',
  known => GAMMA * need(known, 'pressurePa') / (need(known, 'c') * need(known, 'c')),
  {
    rho: known => densityResult(GAMMA * need(known, 'pressurePa') / (need(known, 'c') * need(known, 'c'))),
    pressurePa: known => densityResult(need(known, 'rho') * need(known, 'c') * need(known, 'c') / GAMMA),
    c: known => densityResult(Math.sqrt(GAMMA * need(known, 'pressurePa') / need(known, 'rho'))),
  },
));

const SOUND: AirRelation = Object.freeze(new FieldRelation<'tempK' | 'humidityPct' | 'pressurePa' | 'c'>(
  'c = f(T, RH, p), the WinISD air model',
  ['tempK', 'humidityPct', 'pressurePa', 'c'],
  'c',
  known => soundSpeed(need(known, 'tempK'), need(known, 'humidityPct'), need(known, 'pressurePa')),
  {
    c: known => {
      const c = soundSpeed(need(known, 'tempK'), need(known, 'humidityPct'), need(known, 'pressurePa'));
      return Number.isFinite(c) ? solved(c) : failed('no air at these conditions');
    },
    tempK: (known, widths) => soundBracket(
      x => soundSpeed(x, need(known, 'humidityPct'), need(known, 'pressurePa')), LIMITS.tempK, known, widths),
    humidityPct: (known, widths) => soundBracket(
      x => soundSpeed(need(known, 'tempK'), x, need(known, 'pressurePa')), LIMITS.humidityPct, known, widths),
    pressurePa: (known, widths) => soundBracket(
      x => soundSpeed(need(known, 'tempK'), need(known, 'humidityPct'), x), LIMITS.pressurePa, known, widths),
  },
));

const RELATIONS: readonly AirRelation[] = Object.freeze<AirRelation[]>([DENSITY, SOUND]);

/** Pressure and c together, with T, RH and ρ known: ρ·f(p)² = γ·p has one root in p. */
function solveCoupled(known: Known): {readonly p: number; readonly c: number} | null {
  const t = need(known, 'tempK'), rh = need(known, 'humidityPct'), rho = need(known, 'rho');
  const {min, max} = LIMITS.pressurePa;
  const p = bisect(x => rho * soundSpeed(t, rh, x) ** 2 - GAMMA * x, min, max);
  if (p === null) return null;
  const c = soundSpeed(t, rh, p);
  return Number.isFinite(c) ? {p, c} : null;
}

/** First-order half-width of a solved value: each input moved by its own half-width, summed. */
function propagatedWidth(
  inputs: readonly AirQuantityName[], known: Known, widths: Known,
  compute: (k: Known) => number | null, value: number,
): number {
  let total = 0;
  for (const name of inputs) {
    const w = widths.get(name) ?? 0;
    if (!(w > 0)) continue;
    const bumped = new Map(known);
    bumped.set(name, need(known, name) + w);
    const moved = compute(bumped);
    if (moved !== null && Number.isFinite(moved)) total += Math.abs(moved - value);
  }
  return total;
}

function withinLimits(name: AirQuantityName, value: number): boolean {
  const {min, max} = LIMITS[name];
  return Number.isFinite(value) && value >= min && value <= max && (name !== 'c' && name !== 'rho' || value > 0);
}

function unavailable(target: AirQuantityName, relation: AirRelation, why: string, known: Known): AirIssue {
  return missingDependencies(target, [{
    formula: `${relation.formula} - ${why}`,
    required: relation.fields.filter(f => f !== target && known.has(f)),
    missing: [target],
  }]);
}

export function solveAir(inputs: AirInputs): AirSolution {
  const known = new Map<AirQuantityName, number>();
  const widths = new Map<AirQuantityName, number>();
  for (const name of QUANTITIES) {
    const input = inputs[name];
    if (input.kind === 'entered') { known.set(name, input.value); widths.set(name, input.precision); }
  }
  const issues: AirIssue[] = [];
  const gaveUp = new Set<AirQuantityName>();
  const used = new Set<AirRelation>();

  const record = (name: AirQuantityName, value: number, width: number): void => {
    known.set(name, value);
    widths.set(name, width);
  };

  for (let progressed = true; progressed;) {
    progressed = false;
    for (const rel of RELATIONS) {
      const step = rel.solveOpen(known, widths, gaveUp);
      if (step === null) continue;
      const {target, outcome} = step;
      used.add(rel);
      if (outcome.kind === 'failed' || !withinLimits(target, outcome.value)) {
        gaveUp.add(target);
        issues.push(unavailable(target, rel, outcome.kind === 'failed' ? outcome.why : 'the answer is outside its limits', known));
      } else {
        const others = rel.fields.filter(f => f !== target);
        record(target, outcome.value, propagatedWidth(others, known, widths, k => {
          const o = step.again(k);
          return o.kind === 'solved' ? o.value : null;
        }, outcome.value));
        progressed = true;
      }
      break;
    }
  }

  if (!known.has('pressurePa') && !known.has('c') && known.has('tempK') && known.has('humidityPct') && known.has('rho')
      && !gaveUp.has('pressurePa')) {
    const both = solveCoupled(known);
    used.add(DENSITY);
    used.add(SOUND);
    if (both === null || !withinLimits('pressurePa', both.p) || !withinLimits('c', both.c)) {
      gaveUp.add('pressurePa');
      gaveUp.add('c');
      issues.push(unavailable('pressurePa', SOUND, 'no pressure in range fits this density', known));
      issues.push(unavailable('c', DENSITY, 'no pressure in range fits this density', known));
    } else {
      const ins: readonly AirQuantityName[] = ['tempK', 'humidityPct', 'rho'];
      record('pressurePa', both.p, propagatedWidth(ins, known, widths, k => solveCoupled(k)?.p ?? null, both.p));
      record('c', both.c, propagatedWidth(ins, known, widths, k => solveCoupled(k)?.c ?? null, both.c));
    }
  }

  for (const name of QUANTITIES) {
    if (known.has(name) || gaveUp.has(name)) continue;
    const routes = RELATIONS.filter(r => r.fields.includes(name)).map(r => ({
      formula: r.formula,
      required: r.fields.filter(f => f !== name && known.has(f)),
      missing: r.fields.filter(f => !known.has(f)),
    }));
    issues.push(missingDependencies(name, routes));
  }

  // A relation that solved nothing but has all its quantities known must agree with them.
  for (const rel of RELATIONS) {
    if (used.has(rel) || !rel.fields.every(f => known.has(f))) continue;
    const expected = rel.predict(known);
    if (!Number.isFinite(expected)) continue;
    const actual = need(known, rel.target);
    let tolerance = widths.get(rel.target) ?? 0;
    for (const f of rel.fields) {
      const w = widths.get(f) ?? 0;
      if (f === rel.target || !(w > 0)) continue;
      const bumped = new Map(known);
      bumped.set(f, need(known, f) + w);
      const moved = rel.predict(bumped);
      if (Number.isFinite(moved)) tolerance += Math.abs(moved - expected);
    }
    const residual = Math.abs(expected - actual);
    if (residual > tolerance) {
      issues.push(inconsistentInputs(rel.target, rel.fields, rel.formula, expected, actual,
        (residual - tolerance) / Math.max(Math.abs(actual), Math.abs(expected))));
    }
  }

  const tempK = known.get('tempK');
  if (tempK !== undefined) issues.push(...temperatureIssues(tempK));

  return {
    values: {
      tempK: known.get('tempK') ?? null, humidityPct: known.get('humidityPct') ?? null,
      pressurePa: known.get('pressurePa') ?? null, c: known.get('c') ?? null, rho: known.get('rho') ?? null,
    },
    issues,
  };
}
