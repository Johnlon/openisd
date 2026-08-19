/**
 * The `.owdr` file format boundary — the app's own record, `_OpenISDDriverJson`, written and
 * read as plain JSON. Same two-verb shape as `winIsdDriverFileIo.ts` (its `.wdr` counterpart),
 * so a caller with a chosen format calls the matching module by name and both look identical
 * from the outside — but this module never touches `WinISDDriver`; `.owdr` IS the record, with
 * no format-specific class of its own to keep private.
 */
import type { OpenISDDriver, _OpenISDDriverJson } from '@openisd/model';
import type { Result } from '@openisd/engine';

/**
 * Human ruling: the ONLY files, `packages/`-relative, permitted to name `_parseOwdr` —
 * enforced by `packages/ui/test/ui/architecture.test.ts` the same way as
 * `_OpenISDDriverJsonPrivateAllow` in openisdDriver.ts. ONLY the human may add, remove, or
 * change an entry here — no agent may edit this list on its own judgement.
 */
export const _parseOwdrPrivateAllow: string[] = [];

/** `.owdr` text → the app's one record shape — handed straight to STORAGE (`ManagedOpenISDProject`,
 *  My Drivers), one of the three places permitted to hold the JSON record, per its own
 *  serialisation needs. */
export function _parseOwdr(text: string): _OpenISDDriverJson {
  return JSON.parse(text) as _OpenISDDriverJson;
}

/**
 * A driver → `.owdr` text. Always succeeds — a record is always representable as its own JSON
 * — but `Result` for symmetry with `winIsdDriverFileIo.ts`.
 */
export function exportDriver(driver: OpenISDDriver): Result<string> {
  return { value: JSON.stringify(driver.toRecord(), null, 2), errors: [] };
}
