/**
 * Spinner stepping for number inputs: arrows, wheel, keyboard up/down and the mobile ▲▼ buttons.
 *
 * `decade`: a step is a tenth of the value's decade (1 → 1.1, 10 → 11, 0.5 → 0.51), so a press
 * moves the value proportionally at any scale, never finer than `10^finestExp`. Down from a power
 * of ten uses the decade below (1 → 0.99), and the result lands on the step's grid, so up and
 * down across a decade boundary retrace each other. Signed values step on |v|: away from zero
 * grows, towards zero shrinks; at 0 the step is `10^finestExp`.
 *
 * `integer`: a count; every press is 1.
 */
export type SpinRule =
  | {readonly kind: 'decade'; readonly finestExp: number}
  | {readonly kind: 'integer'};

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

/** The exponent of the step a press takes from `v` in direction `dir`. */
function stepExponent(v: number, dir: SpinDirection, rule: SpinRule): number {
  if (rule.kind === 'integer') return 0;
  const m = Math.abs(v);
  if (!(m > 0)) return rule.finestExp;
  const towardsZero = (v > 0) !== (dir > 0);
  const decade = exponentOf(m) - 1 - (towardsZero && isPowerOfTen(m) ? 1 : 0);
  return Math.max(decade, rule.finestExp);
}

function parseShown(shown: string): number {
  const v = parseFloat(shown);
  return isFinite(v) ? v : 0;
}

/** The value one spinner press in direction `dir` takes the input showing `shown` to. */
export function spinValue(shown: string, dir: SpinDirection, rule: SpinRule, bounds: SpinBounds): number {
  const v = parseShown(shown);
  const e = stepExponent(v, dir, rule);
  // Work in whole steps: `v / 10^e`, with a float tail on an on-grid value treated as on-grid.
  const units = v / Number(`1e${e}`);
  const nearest = Math.round(units);
  const onGrid = Math.abs(units - nearest) < 1e-6;
  const k = dir > 0
    ? (onGrid ? nearest : Math.floor(units)) + 1
    : (onGrid ? nearest : Math.ceil(units)) - 1;
  // `Number('11e-1')` is the exact decimal 1.1; `11 * 0.1` is 1.1000000000000001.
  const next = Number(`${k}e${e}`);
  if (next < bounds.min) return bounds.min;
  if (bounds.max !== undefined && next > bounds.max) return bounds.max;
  return next;
}

/** The native `step` attribute for an input showing `shown`: the step an up press takes. Never
 *  `'any'`, so the browser's own arrows and wheel always move the value. */
export function spinStepAttr(shown: string, rule: SpinRule): string {
  return String(Number(`1e${stepExponent(parseShown(shown), 1, rule)}`));
}

/** The rule for an input with no field: a decade step, never finer than the decimals in `shown`. */
export function shownSpinRule(shown: string): SpinRule {
  return {kind: 'decade', finestExp: 0 - (shown.split('.')[1] || '').length};
}

/** The rule for an input with no field but a stated precision: a decade step, never finer than
 *  `decimals` places. */
export function decimalsSpinRule(decimals: number): SpinRule {
  return {kind: 'decade', finestExp: 0 - decimals};
}
