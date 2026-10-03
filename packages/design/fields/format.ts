/** Fixed-decimal number formatting for readouts. */

export function formatFixed(v: number, decimals: number): string {
  return v.toFixed(decimals);
}

/** `v` to `decimals` places; a dash when `v` is missing or not finite. */
export function formatFixedOrDash(v: number | null, decimals: number): string {
  return v != null && isFinite(v) ? v.toFixed(decimals) : '—';
}
