import type {SpinBounds, SpinDirection} from './spinnerStep.js';

/**
 * Spinning at the caret (John, 2026-10-15: "spin the digits at the precision of the position of the
 * cursor"). One step is one unit of the digit the caret is on: just right of the units digit it is
 * 1, just right of the tenths digit 0.1, just left of a tens digit 10. The digit is the one left of
 * the caret; where the caret sits left of a number or just after the point, it is the one to its
 * right. Carries propagate (19.9 → 20.0), the decimals shown never change, and the caret stays on
 * the same digit. An OpenISD extra: WinISD steps by a fixed increment and has no caret.
 */
export interface CaretSpin {
  /** The stepped text, with as many decimals as the text had; "." is the decimal mark. */
  readonly text: string;
  readonly value: number;
  /** Where the caret goes: on the same digit it was on. */
  readonly caret: number;
  /** Where the MARK goes: the index in `text` of the stepped digit, recomputed from `place`
   *  in the new text (never the old character index) — the one digit a selection or an
   *  underline covers. The leading digit when `place` itself no longer exists after the step. */
  readonly mark: number;
  /** The place value of the stepped digit in `text`: its power of ten (tenths = -1, units = 0,
   *  tens = 1). Typed, never a string — the mark follows this, not the caret's old offset. */
  readonly place: number;
  /** The decimals the stepped digit needs at least; the text already has them. */
  readonly decimals: number;
}

const NUMBER_TEXT = /^(-?)(\d*)(?:[.,](\d*))?$/;

/** The power of ten of the digit at `index` in text whose decimal mark is at `pointIndex`. */
function exponentAt(index: number, pointIndex: number): number {
  return index < pointIndex ? pointIndex - 1 - index : -(index - pointIndex);
}

/** The index of the digit of power `exp` in `text`, or -1 when the number is too short to have it. */
function indexOfExponent(text: string, exp: number): number {
  const mark = text.indexOf('.');
  const pointIndex = mark < 0 ? text.length : mark;
  const signLength = text.startsWith('-') ? 1 : 0;
  const index = exp >= 0 ? pointIndex - 1 - exp : pointIndex - exp;
  return index < signLength ? -1 : index;
}

/**
 * One caret step of `text` (a number as typed or shown, "-" and "." or "," allowed) with the caret
 * at `caret`. `null` when there is nothing to step at the caret: no number, an exponent, the caret
 * left of the sign, or a point with no digit beside it. The caller then steps as it always did.
 */
export function caretSpin(text: string, caret: number, dir: SpinDirection, bounds: SpinBounds): CaretSpin | null {
  const parts = NUMBER_TEXT.exec(text);
  if (parts === null) return null;
  const negative = parts[1] === '-';
  const whole = parts[2];
  const fraction = parts[3] ?? '';
  if (whole === '' && fraction === '') return null;
  const signLength = negative ? 1 : 0;
  const pointIndex = signLength + whole.length;
  if (caret < 0 || caret > text.length || (negative && caret === 0)) return null;

  const isDigitAt = (i: number): boolean => i >= signLength && i < text.length && i !== pointIndex;
  let digitIndex: number;
  let after: boolean;
  if (caret >= 1 && isDigitAt(caret - 1)) { digitIndex = caret - 1; after = true; }
  else if (isDigitAt(caret)) { digitIndex = caret; after = false; }
  else return null;

  const spun = stepAtPlace(negative, whole, fraction, exponentAt(digitIndex, pointIndex), dir, bounds);
  return after ? spun : {...spun, caret: spun.mark};
}

/** `text` (already parsed) stepped by one unit of the place `exp`, with as many decimals as the text
 *  had, or as `exp` needs when it has fewer. The caret sits just right of the stepped digit; mark and
 *  caret go to the leading digit when the place no longer exists after the step. */
function stepAtPlace(negative: boolean, whole: string, fraction: string, exp: number, dir: SpinDirection, bounds: SpinBounds): CaretSpin {
  const decimals = Math.max(fraction.length, -exp);
  const units = Number(`${whole}${fraction.padEnd(decimals, '0')}`) * (negative ? -1 : 1);
  const stepped = units + dir * Number(`1e${exp + decimals}`);
  let value = Number(`${stepped}e-${decimals}`);
  if (value < bounds.min) value = bounds.min;
  if (bounds.max !== undefined && value > bounds.max) value = bounds.max;
  let out = value.toFixed(decimals);
  if (Number(out) === 0) out = out.replace('-', '');

  const at = indexOfExponent(out, exp);
  const signOut = out.startsWith('-') ? 1 : 0;
  const mark = at < 0 ? signOut : at;
  const caret = at < 0 ? signOut : at + 1;
  return {text: out, value, caret, mark, place: exp, decimals};
}

/** The place the last step stepped, and the caret that step left in the box. */
export interface SteppedPlace {
  readonly place: number;
  readonly caret: number | null;
}

/**
 * One step of `text` (John, 2026-10-21: "if I was spinning 10s then it needs to move to 100s as the
 * number grows .. unless human intervenes to move the focus digit"). While the caret is still where
 * the `last` step left it, the step is at that step's place, even when the number has lost that
 * digit (10.5 down a ten is 0.5, up a ten is 10.5 again). Otherwise it is at the caret, the tenths
 * digit by default (`steppingCaret`). `null` when there is no number to step.
 */
export function spinStep(text: string, caret: number | null, last: SteppedPlace | null, dir: SpinDirection, bounds: SpinBounds): CaretSpin | null {
  if (last !== null && last.caret === caret) {
    const parts = NUMBER_TEXT.exec(text);
    if (parts !== null && (parts[2] !== '' || (parts[3] ?? '') !== '')) {
      return stepAtPlace(parts[1] === '-', parts[2], parts[3] ?? '', last.place, dir, bounds);
    }
  }
  return caretSpin(text, steppingCaret(text, caret), dir, bounds)
    ?? caretSpin(text, tenthsCaret(text), dir, bounds);
}

/** The caret of a number nobody has put a caret in: just after the tenths digit, so a step is 0.1.
 *  A number shown with no decimals steps at its last digit, because a step never adds decimals. */
export function tenthsCaret(text: string): number {
  const mark = text.search(/[.,]/);
  return mark >= 0 && mark + 1 < text.length ? mark + 2 : text.length;
}

/** Where a step starts: the tenths digit by default (John, 2026-10-21: "by default start the spin at
 *  the 1/10th unit"). A caret the person put on a digit is kept; no caret, or a caret at the very end
 *  (where typing leaves it, which is not a chosen digit), means the default. */
export function steppingCaret(text: string, caret: number | null): number {
  return caret === null || caret >= text.length ? tenthsCaret(text) : caret;
}

/** A held ▲▼ waits this long before it repeats. */
export const CARET_HOLD_START_MS = 400;
const CARET_HOLD_SLOW_PER_S = 3;
const CARET_HOLD_FAST_PER_S = 12;
const CARET_HOLD_RAMP_MS = 3000;

/** Milliseconds from one repeated step to the next, `heldMs` after the press: 3 steps a second at
 *  the start of the repeat, easing smoothly up to 12 a second over 3 seconds. The step stays at the
 *  caret digit throughout. */
export function caretRepeatDelayMs(heldMs: number): number {
  const eased = Math.min(1, Math.max(0, (heldMs - CARET_HOLD_START_MS) / CARET_HOLD_RAMP_MS));
  return 1000 / (CARET_HOLD_SLOW_PER_S + (CARET_HOLD_FAST_PER_S - CARET_HOLD_SLOW_PER_S) * eased);
}
