/** Every stored or transmitted date is ISO 8601 basic format, UTC: `20260101T010203Z`.
 *  Human text ("2026-01-01 01:02") is display only, made by the design date formatter from the
 *  `Date` this module parses. */

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** `epochMs` as `20260101T010203Z` (seconds, UTC). */
export function basicUtc(epochMs: number): string {
  const d = new Date(epochMs);
  return `${pad(d.getUTCFullYear(), 4)}${pad(d.getUTCMonth() + 1, 2)}${pad(d.getUTCDate(), 2)}`
    + `T${pad(d.getUTCHours(), 2)}${pad(d.getUTCMinutes(), 2)}${pad(d.getUTCSeconds(), 2)}Z`;
}
