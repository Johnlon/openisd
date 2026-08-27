/**
 * Compares two `WinISDDriver`s field by field and reports where they disagree.
 *
 * Used only by tests, which is why it lives here rather than on the class. The idea it checks
 * is real — read a `.wdr` as WinISD wrote it, derive the same driver independently, and see
 * whether WinISD's stored numbers still agree with ours — but nothing in the app does that
 * today, so a method on `WinISDDriver` would be unused surface pretending to be a feature.
 *
 * `a` is the as-read side, `b` the independently-derived one. Only numbers are compared; text
 * fields like brand and model are not this comparison's job. A field marked `N` on the as-read
 * side is skipped, because there is nothing stated to check.
 */
import { INI_ROWS, type WinISDDriver } from '../src/winisdDriver.js';
import type { DriverError } from '@openisd/design/engine';

/** Relative tolerance. WinISD writes ~15 significant digits, so anything looser hides real drift. */
const REL_TOL = 1e-9;
/** Absolute floor, so two values either side of zero do not fail on a meaningless relative gap. */
const ABS_FLOOR = 1e-12;

export function diffWdrValues(
  a: WinISDDriver, b: WinISDDriver, relTol: number = REL_TOL,
): DriverError[] {
  const out: DriverError[] = [];

  for (const key of INI_ROWS) {
    const cell = a.cell(key);
    if (cell.state === 'N') continue;

    const stated = Number(cell.value);
    const derived = Number(b.cell(key).value);
    if (!isFinite(stated) || !isFinite(derived)) continue;

    const tolerance = Math.max(ABS_FLOOR, relTol * Math.max(Math.abs(stated), Math.abs(derived)));
    if (Math.abs(stated - derived) > tolerance) {
      out.push({
        level: 'warn',
        field: key,
        message: `${key}: the file states ${stated}, but the record independently derives ${derived} — value hand-edited outside openisd, or the record is stale`,
      });
    }
  }

  return out;
}
