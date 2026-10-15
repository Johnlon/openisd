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

  const exp = exponentAt(digitIndex, pointIndex);
  const decimals = fraction.length;
  const units = Number(`${whole}${fraction}`) * (negative ? -1 : 1);
  const stepped = units + dir * Number(`1e${exp + decimals}`);
  let value = Number(`${stepped}e-${decimals}`);
  if (value < bounds.min) value = bounds.min;
  if (bounds.max !== undefined && value > bounds.max) value = bounds.max;
  let out = value.toFixed(decimals);
  if (Number(out) === 0) out = out.replace('-', '');

  const at = indexOfExponent(out, exp);
  const signOut = out.startsWith('-') ? 1 : 0;
  const caretOut = at < 0 ? signOut : after ? at + 1 : at;
  return {text: out, value, caret: caretOut, decimals};
}
