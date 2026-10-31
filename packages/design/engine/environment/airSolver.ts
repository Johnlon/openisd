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
 * A quantity no calculation path gives takes the app's value (`AppAir`), as a calculated one: T,
 * RH and p first, then c and ρ, each followed by a fresh pass of the relations. So a blank value
 * follows the app's Options until it is typed, and a typed c with T cleared gives T from c, not
 * the app's T. A value no path gives and the app cannot give either (its own value outside the
 * limits) is `null` with an issue naming the relation's fields, never a wild number: no root
 * inside the field's limits, a c so coarse that every value in the range matches it.
 */
import {NumberField} from '../../fields/field.js';
import {GAMMA, soundSpeedAt, temperatureIssues} from '../air.js';
import type {AppAir} from '../air.js';
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
  /** The half-width of each value (the typed precision of an entered one, the carried-through
   *  width of a solved one, 0 for the app's value); `null` where there is no value. */
  readonly widths: AirSolvedValues;
  readonly issues: readonly AirIssue[];
}

/** One air quantity's value and its half-width, kept together so neither is read without the other. */
interface Quantity { readonly value: number; readonly width: number }
/** Every quantity at once. A quantity not yet known reads as `OPEN`; a relation never reads its
 *  own open field, so `OPEN` is never used in a sum. */
type Snapshot = Readonly<Record<AirQuantityName, Quantity>>;
const OPEN: Quantity = Object.freeze({value: NaN, width: 0});

function snapshotOf(known: ReadonlyMap<AirQuantityName, Quantity>): Snapshot {
  return {
    tempK: known.get('tempK') ?? OPEN, humidityPct: known.get('humidityPct') ?? OPEN,
    pressurePa: known.get('pressurePa') ?? OPEN, c: known.get('c') ?? OPEN, rho: known.get('rho') ?? OPEN,
  };
}

/** `from` with one quantity's value moved, its width kept. */
function moved(from: Snapshot, name: AirQuantityName, value: number): Snapshot {
  return {...from, [name]: {value, width: from[name].width}};
}

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

type FieldSolver = (known: Snapshot) => Outcome;

/** The one relation field still open, solved: its outcome, and the same solve over other values
 *  (to carry the inputs' half-widths through). */
interface RelationStep {
  readonly target: AirQuantityName;
  readonly outcome: Outcome;
  again(known: Snapshot): Outcome;
}

/** What the loop and the checks need of a relation, whatever its fields. */
interface AirRelation {
  readonly formula: string;
  readonly fields: readonly AirQuantityName[];
  /** The one field a conflict is reported against: the one `predict` calculates. */
  readonly target: AirQuantityName;
  predict(known: Snapshot): number;
  /** Solves the relation's single open field, if exactly one is open and not given up on. */
  solveOpen(known: ReadonlyMap<AirQuantityName, Quantity>, gaveUp: ReadonlySet<AirQuantityName>): RelationStep | null;
}

/** A relation over exactly the fields `F`: the compiler requires a solver for every one of them,
 *  and none for a field the relation lacks. */
class FieldRelation<F extends AirQuantityName> implements AirRelation {
  constructor(
    readonly formula: string,
    readonly fields: readonly F[],
    readonly target: F,
    readonly predict: (known: Snapshot) => number,
    private readonly solvers: {readonly [K in F]: FieldSolver},
  ) {}

  solveOpen(known: ReadonlyMap<AirQuantityName, Quantity>, gaveUp: ReadonlySet<AirQuantityName>): RelationStep | null {
    const open = this.fields.filter(f => !known.has(f));
    const target = open[0];
    if (open.length !== 1 || target === undefined || gaveUp.has(target)) return null;
    const solver = this.solvers[target];
    return {target, outcome: solver(snapshotOf(known)), again: solver};
  }
}

function densityResult(v: number): Outcome {
  return Number.isFinite(v) ? solved(v) : failed('the density relation gives no number');
}

/** Solves one of T, RH, p from a typed c, given `at`: c as a function of that quantity. */
function soundBracket(
  at: (x: number) => number, limits: {readonly min: number; readonly max: number},
  known: Snapshot,
): Outcome {
  const {value: c, width} = known.c;
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
  k => GAMMA * k.pressurePa.value / (k.c.value * k.c.value),
  {
    rho: k => densityResult(GAMMA * k.pressurePa.value / (k.c.value * k.c.value)),
    pressurePa: k => densityResult(k.rho.value * k.c.value * k.c.value / GAMMA),
    c: k => densityResult(Math.sqrt(GAMMA * k.pressurePa.value / k.rho.value)),
  },
));

const SOUND: AirRelation = Object.freeze(new FieldRelation<'tempK' | 'humidityPct' | 'pressurePa' | 'c'>(
  'c = f(T, RH, p), the WinISD air model',
  ['tempK', 'humidityPct', 'pressurePa', 'c'],
  'c',
  k => soundSpeed(k.tempK.value, k.humidityPct.value, k.pressurePa.value),
  {
    c: k => {
      const c = soundSpeed(k.tempK.value, k.humidityPct.value, k.pressurePa.value);
      return Number.isFinite(c) ? solved(c) : failed('no air at these conditions');
    },
    tempK: k => soundBracket(x => soundSpeed(x, k.humidityPct.value, k.pressurePa.value), LIMITS.tempK, k),
    humidityPct: k => soundBracket(x => soundSpeed(k.tempK.value, x, k.pressurePa.value), LIMITS.humidityPct, k),
    pressurePa: k => soundBracket(x => soundSpeed(k.tempK.value, k.humidityPct.value, x), LIMITS.pressurePa, k),
  },
));

const RELATIONS: readonly AirRelation[] = Object.freeze<AirRelation[]>([DENSITY, SOUND]);

/** Pressure and c together, with T, RH and ρ known: ρ·f(p)² = γ·p has one root in p. */
function solveCoupled(known: Snapshot): {readonly p: number; readonly c: number} | null {
  const t = known.tempK.value, rh = known.humidityPct.value, rho = known.rho.value;
  const {min, max} = LIMITS.pressurePa;
  const p = bisect(x => rho * soundSpeed(t, rh, x) ** 2 - GAMMA * x, min, max);
  if (p === null) return null;
  // The root has finite c: c grows without bound towards the corner where the model gives NaN,
  // so the residual stays positive up to that edge and cannot change sign there.
  return {p, c: soundSpeed(t, rh, p)};
}

/** First-order half-width of a solved value: each input moved by its own half-width, summed. */
function propagatedWidth(
  inputs: readonly AirQuantityName[], known: Snapshot,
  compute: (k: Snapshot) => number | null, value: number,
): number {
  let total = 0;
  for (const name of inputs) {
    const {value: at, width} = known[name];
    if (!(width > 0)) continue;
    const result = compute(moved(known, name, at + width));
    if (result !== null && Number.isFinite(result)) total += Math.abs(result - value);
  }
  return total;
}

function withinLimits(name: AirQuantityName, value: number): boolean {
  const {min, max} = LIMITS[name];
  return Number.isFinite(value) && value >= min && value <= max && (name !== 'c' && name !== 'rho' || value > 0);
}

function unavailable(target: AirQuantityName, relation: AirRelation, why: string, known: ReadonlyMap<AirQuantityName, Quantity>): AirIssue {
  return missingDependencies(target, [{
    formula: `${relation.formula} - ${why}`,
    required: relation.fields.filter(f => f !== target && known.has(f)),
    missing: [target],
  }]);
}

/** The app's value of one air quantity. */
function appValue(appAir: AppAir, name: AirQuantityName): number {
  switch (name) {
    case 'tempK': return appAir.temperature();
    case 'humidityPct': return appAir.humidity();
    case 'pressurePa': return appAir.pressure();
    case 'c': return appAir.c();
    case 'rho': return appAir.rho();
  }
}

export function solveAir(inputs: AirInputs, appAir: AppAir): AirSolution {
  const known = new Map<AirQuantityName, Quantity>();
  for (const name of QUANTITIES) {
    const input = inputs[name];
    if (input.kind === 'entered') known.set(name, {value: input.value, width: input.precision});
  }
  const issues: AirIssue[] = [];
  const gaveUp = new Set<AirQuantityName>();
  const used = new Set<AirRelation>();

  const record = (name: AirQuantityName, value: number, width: number): void => {
    known.set(name, {value, width});
  };

  const propagate = (): void => {
    for (let progressed = true; progressed;) {
      progressed = false;
      for (const rel of RELATIONS) {
        const step = rel.solveOpen(known, gaveUp);
        if (step === null) continue;
        const {target, outcome} = step;
        used.add(rel);
        if (outcome.kind === 'failed' || !withinLimits(target, outcome.value)) {
          gaveUp.add(target);
          issues.push(unavailable(target, rel, outcome.kind === 'failed' ? outcome.why : 'the answer is outside its limits', known));
        } else {
          const others = rel.fields.filter(f => f !== target);
          record(target, outcome.value, propagatedWidth(others, snapshotOf(known), k => {
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
      const snap = snapshotOf(known);
      const both = solveCoupled(snap);
      used.add(DENSITY);
      used.add(SOUND);
      if (both === null || !withinLimits('pressurePa', both.p) || !withinLimits('c', both.c)) {
        gaveUp.add('pressurePa');
        gaveUp.add('c');
        issues.push(unavailable('pressurePa', SOUND, 'no pressure in range fits this density', known));
        issues.push(unavailable('c', DENSITY, 'no pressure in range fits this density', known));
      } else {
        const ins: readonly AirQuantityName[] = ['tempK', 'humidityPct', 'rho'];
        record('pressurePa', both.p, propagatedWidth(ins, snap, k => solveCoupled(k)?.p ?? null, both.p));
        record('c', both.c, propagatedWidth(ins, snap, k => solveCoupled(k)?.c ?? null, both.c));
      }
    }

  };
  propagate();

  // No path gave these: the app's value stands in, then the relations run again from it.
  for (const name of QUANTITIES) {
    if (known.has(name)) continue;
    const value = appValue(appAir, name);
    if (!withinLimits(name, value)) continue;
    record(name, value, 0);
    propagate();
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
  const final = snapshotOf(known);
  for (const rel of RELATIONS) {
    if (used.has(rel) || !rel.fields.every(f => known.has(f))) continue;
    const expected = rel.predict(final);
    if (!Number.isFinite(expected)) continue;
    const actual = final[rel.target].value;
    let tolerance = final[rel.target].width;
    for (const f of rel.fields) {
      const {value, width} = final[f];
      if (f === rel.target || !(width > 0)) continue;
      const bumped = rel.predict(moved(final, f, value + width));
      if (Number.isFinite(bumped)) tolerance += Math.abs(bumped - expected);
    }
    const residual = Math.abs(expected - actual);
    if (residual > tolerance) {
      issues.push(inconsistentInputs(rel.target, rel.fields, rel.formula, expected, actual,
        (residual - tolerance) / Math.max(Math.abs(actual), Math.abs(expected))));
    }
  }

  const tempK = known.get('tempK');
  if (tempK !== undefined) issues.push(...temperatureIssues(tempK.value));

  const valueOf = (name: AirQuantityName): number | null => known.get(name)?.value ?? null;
  const widthOf = (name: AirQuantityName): number | null => known.get(name)?.width ?? null;
  return {
    widths: {
      tempK: widthOf('tempK'), humidityPct: widthOf('humidityPct'), pressurePa: widthOf('pressurePa'), c: widthOf('c'), rho: widthOf('rho'),
    },
    values: {
      tempK: valueOf('tempK'), humidityPct: valueOf('humidityPct'),
      pressurePa: valueOf('pressurePa'), c: valueOf('c'), rho: valueOf('rho'),
    },
    issues,
  };
}
