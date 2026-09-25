import {describe, expect, it} from 'vitest';
import type {DriverIssue, OutOfRangeIssue} from '../../engine/index.js';
import {checkConsistency, driverParams} from './testSolver.js';

/** `checkRange` (D5/O4) is private to `solver.ts`'s door — `Engine.solveDriver` is the one public
 *  path that runs it, alongside `checkConsistency` (S2-10: both checks are co-located inside
 *  `solveDriver`, same as every other node's solve+check pair). `checkConsistency` here is
 *  `testSolver.ts`'s own wrapper for that call (see its doc comment), matching
 *  `consistency.test.ts`'s own precedent for testing the driver solve's issue channel. */
function rangeIssues(d: Parameters<typeof driverParams>[0]): readonly OutOfRangeIssue[] {
  return checkConsistency(d).filter((i): i is OutOfRangeIssue => i.kind === 'out-of-range');
}

describe('checkRange (D5/O4)', () => {
  it('reports below when an entered field falls under its band', () => {
    expect(rangeIssues({ Qts: 0.001 })).toEqual([{ kind: 'out-of-range', field: 'Qts', value: 0.001, limit: 0.01, side: 'below' }]);
  });

  it('reports above when an entered field rises over its band', () => {
    expect(rangeIssues({ Fs_hz: 9000 })).toEqual([{ kind: 'out-of-range', field: 'Fs_hz', value: 9000, limit: 5000, side: 'above' }]);
  });

  it('reports nothing for a value inside its band', () => {
    expect(rangeIssues({ Qts: 0.4, Fs_hz: 45 })).toEqual([]);
  });

  it('reports nothing for a field PHYSICAL_RANGE has no band for', () => {
    expect(rangeIssues({ Gloss: -50 })).toEqual([]);
  });

  it('skips zero — the .wdr not-present sentinel, never a real physical value', () => {
    expect(rangeIssues({ Hc_m: 0 })).toEqual([]);
  });

  it('reports one issue per out-of-band field, independently', () => {
    const issues = rangeIssues({ Qts: 0.001, Fs_hz: 9000 });
    expect(issues).toHaveLength(2);
    expect(issues.map(i => i.field).sort()).toEqual(['Fs_hz', 'Qts']);
  });

  it('skips a not-entered field even when the solve derives an out-of-band value for it', () => {
    // Sd from a huge Dd resolves Sd_m2 far past its own 0.3 m² band (Dd = 2·√(Sd/π)), but Sd_m2
    // itself was never entered — only Dd_m was — so it must not fire.
    const issues: readonly DriverIssue[] = checkConsistency({ Dd_m: 5 });
    expect(issues.filter(i => i.kind === 'out-of-range' && i.field === 'Sd_m2')).toEqual([]);
  });
});
