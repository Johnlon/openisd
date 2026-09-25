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
