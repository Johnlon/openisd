/**
 * WinISD's own `dateStamp` is `YYYYMMDD` (`packages/design/domain/appContext.ts`) — the exact
 * byte format `.wpr` round-trip goldens pin for Created/Modified. Display-only: format for
 * reading, parse back for writing; the stored string itself is never touched by either.
 *
 * Bug (John, live on his phone, 2026-09-29): "dates should be yyyy-mm-dd" — the Project tab was
 * showing (and editing) the raw storage string with no separators.
 */
export function formatDateStamp(raw: string): string {
  return raw.length === 8 ? `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}` : raw;
}

export function parseDateStamp(display: string): string {
  return display.replace(/\D/g, '');
}
