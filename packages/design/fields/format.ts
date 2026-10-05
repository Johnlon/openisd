/** Fixed-decimal number formatting for readouts. */

export function formatFixed(v: number, decimals: number): string {
  return v.toFixed(decimals);
}

/** `v` to `decimals` places; a dash when `v` is missing or not finite. */
export function formatFixedOrDash(v: number | null, decimals: number): string {
  return v != null && isFinite(v) ? v.toFixed(decimals) : '—';
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "2026-10-05" — local calendar date in ISO order, built by hand so the browser locale never shows through. */
export function formatDate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "2026-10-05 23:32" — local date and 24-hour clock, no seconds. Every date/time a user sees. */
export function formatDateTime(d: Date): string {
  return `${formatDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "1,234,567" — a whole number grouped in thousands with commas, whatever the browser locale. */
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
