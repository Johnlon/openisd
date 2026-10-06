/**
 * Spinner stepping for number inputs: arrows, wheel, keyboard up/down and the ▲▼ buttons.
 * John, 2026-10-06: "little taps or short holds should spin slowly, it needs to accelerate within
 * sensible limits", and "after a long spin it zooms to a round value when released".
 *
 * `proportional`, at two speeds:
 * - `fine` (a tap, a short hold, a key press, the wheel): one unit of the value's 3rd significant
 *   digit, about 1 % (10.70 → 10.80, 1.07 → 1.08), never finer than `10^finestExp`. Down from a
 *   power of ten uses the decade below (10 → 9.99), so up and down retrace each other.
 * - `fast` (a long hold): 10 % a press, ×1.1 up and ÷1.1 down, on the `10^finestExp` grid.
 * `roundSpun` then lands a long spin on a round value: two significant digits (13.27 → 13).
 * Signed values step on |v|: away from zero grows, towards zero shrinks, and the last step
 * towards zero lands on 0; from 0 the step is `10^finestExp`.
 *
 * `integer`: a count; every press is 1 at either speed, and is already round.
 */
export type SpinRule =
  | {readonly kind: 'proportional'; readonly finestExp: number}
  | {readonly kind: 'integer'};

/** How far one press moves: `fine` for a tap or short hold, `fast` once a hold has run on. */
export type SpinSpeed = 'fine' | 'fast';

/** Spin direction: up (+1) or down (−1). */
export type SpinDirection = 1 | -1;

/** The range a spin result is clamped to, in the input's display unit. */
export interface SpinBounds {
  readonly min: number;
  readonly max: number | undefined;
}

/** The power of ten of the leading digit of `m > 0`, read from its exact decimal form. */
function exponentOf(m: number): number {
  return parseInt(m.toExponential().split('e')[1], 10);
}

/** Whether `m > 0` is exactly a power of ten. */
function isPowerOfTen(m: number): boolean {
  return m.toExponential().split('e')[0] === '1';
}

/** A fast press: 10 %. */
const FAST_RATIO = 1.1;
/** A fine press moves the value's 3rd significant digit. */
const FINE_DIGIT = 3;
/** A round value has 2 significant digits. */
const ROUND_DIGITS = 2;

/** `v` on the grid of `10^e`, as an exact decimal (`Number('11e-1')` is 1.1; `11 * 0.1` is not). */
function onGrid(v: number, e: number): number {
  return Number(`${Math.round(v / Number(`1e${e}`))}e${e}`);
}

/** The magnitude one press takes `m >= 0` to. */
function stepMagnitude(m: number, grow: boolean, speed: SpinSpeed, finestExp: number): number {
  const finest = Number(`1e${finestExp}`);
  if (!(m > 0)) return grow ? finest : 0;
  if (speed === 'fast') {
    const next = onGrid(grow ? m * FAST_RATIO : m / FAST_RATIO, finestExp);
    if (grow ? next > m : next < m) return next;
    return Math.max(0, onGrid(m + (grow ? finest : -finest), finestExp));
  }
  const decade = exponentOf(m) - (!grow && isPowerOfTen(m) ? 1 : 0);
  const e = Math.max(decade - (FINE_DIGIT - 1), finestExp);
  // Off-grid values land on the grid first, so a step never leaves a ragged tail.
  const units = m / Number(`1e${e}`);
  const nearest = Math.round(units);
  const exact = Math.abs(units - nearest) < 1e-6;
  const k = grow ? (exact ? nearest : Math.floor(units)) + 1 : (exact ? nearest : Math.ceil(units)) - 1;
  return Math.max(0, Number(`${k}e${e}`));
}

function parseShown(shown: string): number {
  const v = parseFloat(shown);
  return isFinite(v) ? v : 0;
}

function clamp(v: number, bounds: SpinBounds): number {
  if (v < bounds.min) return bounds.min;
  if (bounds.max !== undefined && v > bounds.max) return bounds.max;
  return v;
}

/** The value one spinner press in direction `dir` takes the input showing `shown` to. */
export function spinValue(shown: string, dir: SpinDirection, rule: SpinRule, bounds: SpinBounds, speed: SpinSpeed = 'fine'): number {
  const v = parseShown(shown);
  if (rule.kind === 'integer') return clamp(Math.round(v) + dir, bounds);
  if (v === 0) return clamp(dir * Number(`1e${rule.finestExp}`), bounds);
  const grow = (v > 0) === (dir > 0);
  const next = Math.sign(v) * stepMagnitude(Math.abs(v), grow, speed, rule.finestExp);
  return clamp(next === 0 ? 0 : next, bounds);   // never -0
}

/** Where a long spin lands when released: `v` rounded to two significant digits, never finer
 *  than `10^finestExp`, inside `bounds`. */
export function roundSpun(v: number, rule: SpinRule, bounds: SpinBounds): number {
  if (rule.kind === 'integer' || v === 0 || !isFinite(v)) return clamp(v, bounds);
  const e = Math.max(exponentOf(Math.abs(v)) - (ROUND_DIGITS - 1), rule.finestExp);
  return clamp(onGrid(v, e), bounds);
}

/** A held ▲▼ waits this long before it repeats, so a tap never double-fires. */
export const HOLD_START_MS = 450;
/** A hold runs fine steps this long, then 10 % steps. */
const FAST_AFTER_MS = 1000;
/** After this long the repeat speeds up. */
const TURBO_AFTER_MS = 3000;
const REPEAT_MS = 150;
const TURBO_REPEAT_MS = 60;

/** What a ▲▼ held for `heldMs` does: the size of each press and the gap before the next. */
export interface HoldStage {
  readonly speed: SpinSpeed;
  readonly repeatMs: number;
  /** Releasing now lands the value on `roundSpun`'s round number. */
  readonly roundsOnRelease: boolean;
}

export function holdStage(heldMs: number): HoldStage {
  if (heldMs < FAST_AFTER_MS) return {speed: 'fine', repeatMs: REPEAT_MS, roundsOnRelease: false};
  return {speed: 'fast', repeatMs: heldMs < TURBO_AFTER_MS ? REPEAT_MS : TURBO_REPEAT_MS, roundsOnRelease: true};
}

/** The native `step` attribute: the finest step, so every value the box shows is on the native
 *  grid. Never `'any'`, so the browser's own arrows and wheel always move the value; the input then
 *  replaces the browser's value with `spinValue`'s, taking only the direction from it. `shown` is
 *  unused now that the step no longer depends on the value; kept so callers need not change. */
export function spinStepAttr(_shown: string, rule: SpinRule): string {
  return rule.kind === 'integer' ? '1' : String(Number(`1e${rule.finestExp}`));
}

/** The rule for an input with no field: proportional steps, never finer than the decimals in `shown`. */
export function shownSpinRule(shown: string): SpinRule {
  return {kind: 'proportional', finestExp: 0 - (shown.split('.')[1] || '').length};
}

/** The rule for an input with no field but a stated precision: proportional steps, never finer than
 *  `decimals` places. */
export function decimalsSpinRule(decimals: number): SpinRule {
  return {kind: 'proportional', finestExp: 0 - decimals};
}
