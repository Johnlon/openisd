/**
 * Driver file IO that is not bound to a project — reading a driver off the user's disk or a
 * federated library row.
 *
 * ORCHESTRATION ONLY. The parsing, the format decision and the serialisation all live on
 * `OpenISDDriver` itself, because THE OWNER OF THE STATE SERIALIZES IT (human ruling
 * 2026-08-22, QO83): the model already holds the record, so it is the only place that can
 * answer "is this a .wdr or an .owdr" without handing the record shape to someone else. This
 * module parses nothing and sniffs no format — it calls the model's public API and applies the
 * one policy that is genuinely a UI concern: a driver with no identity of its own is named
 * after the file it came from, so it can be filed.
 *
 * It holds the `OpenISDDriver` VALUE import, which the containment gate
 * (`packages/ui/test/ui/architecture.test.ts`) licenses for this file and `managedProject.ts`
 * alone — project-bound driver IO is `ManagedOpenISDProject`'s own methods, not this module.
 * `driverTextFromRecord` also names `_OpenISDDriverJson` (an editor draft is already a record,
 * never a live driver — see `driverSelection.ts`), so it can hand that record to the owner
 * for serialisation instead of a caller hand-rolling `JSON.stringify` on it.
 */
import { OpenISDDriver } from '@openisd/model';
import type { _OpenISDDriverJson } from '@openisd/model';

/** A driver read off the user's disk, or the reason the file could not be read. The driver is
 *  the public domain object — never the record shape. */
export type FileReadResult =
  | { ok: true; driver: OpenISDDriver }
  | { ok: false; error: string };

/**
 * Read a driver file the user picked off their own disk.
 *
 * `format` is the caller's classification (`fileFormat.ts`'s `DriverFileFormat.ofFileName`/
 * `sniff`) — this module names no private type, parses nothing, and sniffs no format itself.
 *
 * The file name also supplies the MODEL when the file itself carries neither brand nor model
 * — a `.wdr` written by another tool need not fill those in, and a driver with no
 * `<brand>/<model>` has no identity to be saved under. The name is the file's own, not an
 * invented value.
 *
 * Reading a file does not touch the project. The driver lands in My Drivers, and choosing it
 * from there is what embeds it — the same one act for every driver, wherever it came from.
 */
export function driverFromFileText(text: string, format: 'wdr' | 'owdr', fileName: string): FileReadResult {
  const { value: driver, errors } = OpenISDDriver.fromFileText(text, format);
  if (!driver) return { ok: false, error: errors[0]?.message ?? `${fileName} could not be read` };

  // A driver IS its <brand>/<model>, so one with neither cannot be filed. The file name is the
  // last thing that can name it; if that is empty too, say so rather than saving it nameless.
  if (!driver.metaCell('brand').value && !driver.metaCell('model').value) {
    const base = fileName.replace(/\.[^.]*$/, '').trim();
    if (!base) return { ok: false, error: `${fileName} carries no brand or model, and its name gives none` };
    driver.enterMeta('model', base);
  }
  return { ok: true, driver };
}

/** WinISD `.wdr` text → the driver it describes — for a caller filing a fetched library row.
 *  Throws what the model's parser throws; the caller owns the user-facing message. */
export function driverFromWdrText(text: string): OpenISDDriver {
  return OpenISDDriver.fromWdrText(text);
}

/** A driver RECORD → its owner's OWN serialisation. THE OWNER OF THE STATE SERIALIZES IT
 *  (QO83): routes through `OpenISDDriver.fromJsonRecord(...).toOwdrText()` rather than a
 *  caller hand-rolling `JSON.stringify` on the record, so a future change to the owner's own
 *  encoding cannot silently diverge from what a caller assembles by hand. */
export function driverTextFromRecord(record: _OpenISDDriverJson): string {
  return OpenISDDriver.fromJsonRecord(record).toOwdrText();
}
