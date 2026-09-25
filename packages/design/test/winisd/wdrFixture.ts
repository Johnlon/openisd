/**
 * Shared `.wdr` fixtures — the 48-row structure, stated here once so no test re-states it.
 *
 * The reader (`openisdSchema.ts`) and the writer (`driverYmlToOpenisdAndWdr.ts`) each spell the
 * 48 rows out explicitly, in the file's own order. This list is the test's independent statement
 * of that order — never derived from production code.
 */
import type { WdrCell } from '../../winisd/winisdDriver.js';

/** The 48 `.wdr` numeric rows, in WinISD's OWN file order. */
export const WDR_FILE_ROWS: readonly string[] = [
  'Qts', 'Znom', 'Fs', 'Pe', 'SPL', 'Re', 'Le', 'fLe', 'KLe', 'BL', 'Xmax', 'Cms', 'Qms', 'Qes',
  'Rms', 'Mms', 'Sd', 'Vas', 'Dia', 'Vd', 'no', 'Dd', 'EBP', 'numVC', 'Hc', 'Hg', 'SPLmax',
  'SPLmaxLF', 'USPL', 'alfaVC', 'Rt', 'Ct', 'gamma', 'Rme', 'Mpow', 'Mcost', 'Gloss', 'VCCon', 'c',
  'roo', 'Thick', 'Depth', 'MagDepth', 'Magnet', 'Basket', 'Outer', 'Vcd', 'DVol',
];

/** One cell per row, marked `not-available` with a `0` value — the blank-driver shape tests build
 *  on when the rows themselves are not what they are checking. */
export function allNotAvailableCells(): ReadonlyArray<readonly [string, WdrCell]> {
  return WDR_FILE_ROWS.map(key => [key, { value: '0', state: 'not-available' }] as const);
}

/** One cell per row, marked `entered`, each at its own distinct value (`offset + i`). */
export function allEnteredCells(offset = 0): ReadonlyArray<readonly [string, WdrCell]> {
  return WDR_FILE_ROWS.map((key, i) => [key, { value: String(offset + i), state: 'entered' }] as const);
}