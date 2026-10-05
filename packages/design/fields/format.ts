/** Fixed-decimal number formatting for readouts. */

export function formatFixed(v: number, decimals: number): string {
  return v.toFixed(decimals);
}

/** `v` to `decimals` places; a dash when `v` is missing or not finite. */
export function formatFixedOrDash(v: number | null, decimals: number): string {
  return v != null && isFinite(v) ? v.toFixed(decimals) : '—';
}

/** English month abbreviations, January first. */
const MONTHS = Object.freeze(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const);

/** "5 Oct 2026" — local calendar date, built by hand so the browser locale never shows through. */
export function formatDate(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 Oct 2026, 23:32" — local date and 24-hour clock, no seconds. Every date/time a user sees. */
export function formatDateTime(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(d)}, ${hh}:${mm}`;
}

/** "1,234,567" — a whole number grouped in thousands with commas, whatever the browser locale. */
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
