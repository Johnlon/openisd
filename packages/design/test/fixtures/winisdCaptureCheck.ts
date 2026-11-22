import assert from 'node:assert/strict';
import type {WinIsdPlottedPoint} from './winisdTwoDriversCapture.js';

/** `bound(v)`: the largest difference allowed from WinISD's value `v`. */
export type Bound = (v: number) => number;
export const relative = (tol: number): Bound => (v) => tol * Math.abs(v);
export const absolute = (tol: number): Bound => () => tol;

/** One plotted WinISD curve compared with the matching OpenISD series. */
export interface CaptureCheck {
  readonly title: string;
  readonly name: string;
  readonly got: readonly number[];
  readonly want: readonly WinIsdPlottedPoint[];
  readonly bound: Bound;
}

/** Every captured point `k` of a WinISD chart is grid point `k·step`; each must sit within the bound. */
export function assertMatchesCapture(check: CaptureCheck, step: number): void {
  check.want.forEach((point, k) => {
    const v = check.got[k * step]!;
    assert.ok(Math.abs(v - point.v) <= check.bound(point.v), `${check.name} @ ${point.f} Hz: got ${v}, WinISD ${point.v}`);
  });
}
