/**
 * Half the last decimal place `v`'s own printed form was written to: `0.0355` -> 0.00005,
 * `37` -> 0.5. The half-width of the rounding interval a value was entered to when no reading's
 * own stated precision is available (D13).
 *
 * Reads the value's shortest round-tripping decimal string (`Number.prototype.toString()`) — the
 * same digits a JSON number literal for `v` would have printed — rather than a fixed-width
 * `toExponential` expansion, whose padding to a constant fraction length answers a different
 * question (the float's own representation floor, not how many digits `v` was typed to).
 */
export function halfUlp(v: number): number {
  if (!isFinite(v) || v === 0) return 0;
  const s = Math.abs(v).toString();
  const eIndex = s.indexOf('e');
  if (eIndex !== -1) {
    const mantissa = s.slice(0, eIndex);
    const exponent = Number(s.slice(eIndex + 1));
    const dot = mantissa.indexOf('.');
    const mantissaDecimals = dot === -1 ? 0 : mantissa.length - dot - 1;
    return 0.5 * Math.pow(10, exponent - mantissaDecimals);
  }
  const dot = s.indexOf('.');
  const decimals = dot === -1 ? 0 : s.length - dot - 1;
  return 0.5 * Math.pow(10, -decimals);
}

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
