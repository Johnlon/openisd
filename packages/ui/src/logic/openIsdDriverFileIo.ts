/**
 * The `.owdr` file format boundary — the app's own record, `_OpenISDDriverJson`, written and
 * read as plain JSON. Same two-verb shape as `winIsdDriverFileIo.ts` (its `.wdr` counterpart),
 * so a caller with a chosen format calls the matching module by name and both look identical
 * from the outside — but this module never touches `WinISDDriver`; `.owdr` IS the record, with
 * no format-specific class of its own to keep private.
 */
import type { OpenISDDriver, _OpenISDDriverJson } from '@openisd/model';
import type { Result } from '@openisd/engine';

/** `.owdr` text → the app's one record shape — handed straight to STORAGE (`ManagedOpenISDProject`,
 *  My Drivers), one of the three places permitted to hold the JSON record, per its own
 *  serialisation needs. */
export function importDriver(text: string): _OpenISDDriverJson {
  return JSON.parse(text) as _OpenISDDriverJson;
}

/**
 * A driver → `.owdr` text. Always succeeds — a record is always representable as its own JSON
 * — but `Result` for symmetry with `winIsdDriverFileIo.ts`.
 *
 * Takes the live `OpenISDDriver`, never the raw record: `OpenISDDriver` is the settled public
 * API for a driver everywhere in this app (human ruling, 2026-08-17) — `.toRecord()` is called
 * here, inside the file-io boundary, and nowhere else this function's callers can see.
 */
export function exportDriver(driver: OpenISDDriver): Result<string> {
  return { value: JSON.stringify(driver.toRecord(), null, 2), errors: [] };
}
