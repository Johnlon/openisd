/**
 * The ONLY module allowed to name `WinISDDriver` (@openisd/winisd) — enforced by
 * architecture.test.ts. `WinISDDriver` is the .wdr FILE FORMAT boundary, not a driver
 * representation, and it never crosses this module's edge: every export here takes or returns
 * `_OpenISDDriverJson` only. A caller that wants a `.wdr` import or export calls one of these
 * two verbs; it never touches `WinISDDriver`, never parses or serialises `.wdr` text itself.
 */
import { WinISDDriver } from '@openisd/winisd';
import { OpenISDDriver } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';
import type { Result } from '@openisd/engine';

/** `.wdr` text → the app's one record shape. */
export function importDriver(text: string): _OpenISDDriverJson {
  return WinISDDriver.fromWdr(text).toOpenISDRecord();
}

/**
 * A driver → `.wdr` text. A `Result`, since not every driver is complete enough to export —
 * `errors` names what is missing.
 *
 * Takes the live `OpenISDDriver`, never the raw `_OpenISDDriverJson` record: `OpenISDDriver` is
 * the settled public API for a driver everywhere in this app, the record is its own internal
 * implementation detail (human ruling, 2026-08-17) — enforced by
 * `architecture.test.ts`'s "a FileIo module's export verb takes OpenISDDriver, never the JSON
 * record" gate.
 *
 * `WinISDDriver` performs no calculation of its own (ARCHITECTURE.md "WinISDDriver is solely a
 * serialisation device"): any value that has no home in the record's own `_SpecSection` — EBP is
 * the one today — is OBTAINED from `OpenISDDriver`'s own getter, the ONE place that formula is
 * allowed to live, and passed to the writer as a plain value. This module never derives it.
 * bugs/BUG_20260817_wdr_writer_computes_ebp_itself_violating_its_own_no-calc-logic_rule.md
 */
export function exportDriver(driver: OpenISDDriver): Result<string> {
  const { value, errors } = WinISDDriver.fromOpenISDRecord(driver.toRecord(), { ebp: driver.ebp() });
  return { value: value ? value.toWdr() : null, errors };
}
