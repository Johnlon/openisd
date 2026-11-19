/**
 * Whether a number typed into a box may be stored, and if not, the sentence its ⚠ shows: what is
 * wrong, then what to enter, in the unit the box is showing. ONE function answers both, so the
 * box never refuses a value without saying why, nor says why about a value it accepts.
 * bugs/BUG_20261005_no-common-ui-field-component.md (ruling "b": a refused entry stays in the box).
 */
import type {ValueFloor} from '@openisd/design/fields';

/** What a box knows about the values it accepts. `min`/`max` are SI; `show` renders an SI value
 *  in the box's current unit, unit symbol excluded. */
export interface EntryBounds {
  readonly label: string;
  readonly unit: string;
  readonly floor: ValueFloor;
  readonly min: number;
  readonly max: number | undefined;
  /** The field's own sentence on why a value below `min` is refused (`NumberField.minimumReason`). */
  readonly minimumReason: string | undefined;
  readonly show: (si: number) => string;
}

/** What was typed: text the browser could not read as a number, or a number already in SI. */
export type Entry =
  | { readonly kind: 'not-a-number' }
  | { readonly kind: 'number'; readonly si: number };

/** The lowest value the floor and `min` together allow, and whether it is itself allowed. */
function lowerBound(b: EntryBounds): { readonly value: number; readonly inclusive: boolean } {
  if (b.floor === 'positive' && b.min <= 0) return { value: 0, inclusive: false };
  return { value: b.floor === 'non-negative' ? Math.max(0, b.min) : b.min, inclusive: true };
}

/** Zero in the box's unit: "0", or where the unit starts elsewhere the number zero is ("-273.15" for
 *  0 K shown in °C), so a temperature floor never reads "above 0 °C". */
function zeroIn(b: EntryBounds): string {
  const zero = b.show(0);
  return Number(zero) === 0 ? '0' : zero;
}

/** "a value between 0.10 and 100.00 L", "a value above 0, up to 10", "a value of at least 0 Hz". */
function allowedRange(b: EntryBounds): string {
  const u = b.unit === '' ? '' : ` ${b.unit}`;
  const lo = lowerBound(b);
  const max = b.max;
  if (!lo.inclusive) return max === undefined ? `a value above ${zeroIn(b)}${u}` : `a value above ${zeroIn(b)}, up to ${b.show(max)}${u}`;
  return max === undefined ? `a value of at least ${b.show(lo.value)}${u}` : `a value between ${b.show(lo.value)} and ${b.show(max)}${u}`;
}

/** '' when `entry` may be stored; otherwise what is wrong and what to enter instead. */
export function entryRefusal(b: EntryBounds, entry: Entry): string {
  const enter = `enter ${allowedRange(b)}.`;
  if (entry.kind === 'not-a-number') return `${b.label} is not a number — ${enter}`;
  const si = entry.si;
  if (!Number.isFinite(si)) return `${b.label} must be a finite number — ${enter}`;
  const lo = lowerBound(b);
  if (lo.inclusive ? si < lo.value : si <= lo.value) {
    const why = b.minimumReason === undefined ? '' : ` ${b.minimumReason}`;
    return lo.inclusive ? `${b.label} is below its minimum — ${enter}${why}` : `${b.label} must be greater than ${zeroIn(b) === '0' ? '0' : `${zeroIn(b)} ${b.unit}`} — ${enter}${why}`;
  }
  if (b.max !== undefined && si > b.max) return `${b.label} is above its maximum — ${enter}`;
  return '';
}
