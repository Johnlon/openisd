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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** "23:32" — local 24-hour clock, no seconds. Every user-visible time. */
export function formatTime(d: Date): string {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** "5 Oct 2026, 23:32" — local date and 24-hour clock, no seconds. Every date/time a user sees. */
export function formatDateTime(d: Date): string {
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${formatTime(d)}`;
}

const BASIC_UTC = /^v?(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z$/;

/** The instant an ISO 8601 basic UTC stamp names — "20260101T0102Z", "20260101T010203Z", a leading
 *  `v` allowed — or null when `stamp` is not one. Stamps are what is stored and sent; this is the
 *  one way back to a Date for display. */
export function parseBasicUtc(stamp: string): Date | null {
  const m = BASIC_UTC.exec(stamp);
  if (!m) return null;
  const [year, month, day, hour, minute, second] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '00'].map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return d.getUTCMonth() === month - 1 && d.getUTCDate() === day ? d : null;
}

/** "1,234,567" — a whole number grouped in thousands with commas, whatever the browser locale. */
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** "512 B", "12.3 KB", "1.2 MB" — a length in bytes, 1024 to the unit, one decimal above bytes. */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${Math.trunc(bytes)} B`;
  if (bytes < 1024 * 1024) return `${formatFixed(bytes / 1024, 1)} KB`;
  return `${formatFixed(bytes / (1024 * 1024), 1)} MB`;
}

/** "1 project", "3 projects", "0 projects" — a count and its noun, plural unless exactly one. */
export function formatCountOf(n: number, noun: string): string {
  return `${formatCount(n)} ${noun}${n === 1 ? '' : 's'}`;
}
