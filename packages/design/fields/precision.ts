/** Significant digits past which a stored double's decimals are float tail, not a statement. */
const MAX_SIGNIFICANT = 10;

/**
 * Decimals that show `value` to the width it is known to: the place of the interval's leading
 * digit. Typed `0.0754` (±0.00005) is 4; a propagated ±0.0046 is 3; ±0.5 is 0. Both arguments in
 * the unit the value is shown in. Capped at `MAX_SIGNIFICANT` significant digits of `value`, so a
 * double read back from a file (`1.9085175370557992`) never prints its float tail. 0 when
 * `halfWidth` states nothing.
 */
export function knownDecimals(halfWidth: number, value: number): number {
  if (!(halfWidth > 0) || !isFinite(halfWidth)) return 0;
  // 1e-6 absorbs the float error of a width carried through a unit factor (5e-7·100).
  const stated = Math.ceil(-Math.log10(2 * halfWidth) - 1e-6);
  const magnitude = Math.abs(value);
  const cap = magnitude > 0 && isFinite(magnitude)
    ? MAX_SIGNIFICANT - 1 - Math.floor(Math.log10(magnitude))
    : stated;
  return Math.max(0, Math.min(stated, cap));
}
