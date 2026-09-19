/**
 * Shared `.wdr` fixtures — the 48-row structure derived from the vocabulary's `wdr` property, so
 * no test hand-maintains the row list.
 *
 * The reader (`winisdDriver.ts`) and the writer (`driverYmlToOpenisdAndWdr.ts`) each spell the
 * 48 rows out explicitly, in the file's own order. The vocabulary (`OPENISD_FIELDS`) lists those
 * wdr-bearing fields first, in that same order, so the rows are taken from it rather than
 * re-stated.
 */
import type { WdrCell } from '../../winisd/winisdDriver.js';
import { OPENISD_FIELDS } from '../../fields/index.js';

/** The 48 `.wdr` numeric rows, in WinISD's OWN file order — the vocabulary's `wdr` values, which
 *  the table lists first, in row order. */
/** A vocabulary entry that carries a `.wdr` row name. */
type WdrDef = Extract<(typeof OPENISD_FIELDS)[keyof typeof OPENISD_FIELDS], { wdr: string }>;

/** The 48 `.wdr` numeric rows, in WinISD's OWN file order — the vocabulary's `wdr` values, which
 *  the table lists first, in row order. */
export const WDR_FILE_ROWS: readonly string[] = Object.values(OPENISD_FIELDS)
  .filter((def): def is WdrDef => 'wdr' in def)
  .map(def => def.wdr);

/** One cell per row, marked `not-available` with a `0` value — the blank-driver shape tests build
 *  on when the rows themselves are not what they are checking. */
export function allNotAvailableCells(): ReadonlyArray<readonly [string, WdrCell]> {
  return WDR_FILE_ROWS.map(key => [key, { value: '0', state: 'not-available' }] as const);
}

/** One cell per row, marked `entered`, each at its own distinct value (`offset + i`). */
export function allEnteredCells(offset = 0): ReadonlyArray<readonly [string, WdrCell]> {
  return WDR_FILE_ROWS.map((key, i) => [key, { value: String(offset + i), state: 'entered' }] as const);
}