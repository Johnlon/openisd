import {describe, expect, it} from 'vitest';
import type {DriverIssue, OutOfRangeIssue} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {checkConsistency, driverParams} from './testSolver.js';

const engine = createEngine();

/** `checkRange` (D5/O4) is private to `solver.ts`'s door — `Engine.solveDriver` is the one public
 *  path that runs it, alongside `checkConsistency` (S2-10: both checks are co-located inside
 *  `solveDriver`, same as every other node's solve+check pair). `checkConsistency` here is
 *  `testSolver.ts`'s own wrapper for that call (see its doc comment), matching
 *  `driver-solve.test.ts`'s own precedent for testing the driver solve's issue channel. */
function rangeIssues(d: Parameters<typeof driverParams>[0]): readonly OutOfRangeIssue[] {
  return checkConsistency(d).filter((i): i is OutOfRangeIssue => i.kind === 'out-of-range');
}

describe('checkRange (D5/O4)', () => {
  it('reports below when an entered field falls under its band', () => {
    expect(rangeIssues({ Qts: 0.001 })).toEqual([engine.issues.outOfRange('Qts', 0.001, 0.01, 'below')]);
  });

  it('reports above when an entered field rises over its band', () => {
    expect(rangeIssues({ Fs_hz: 9000 })).toEqual([engine.issues.outOfRange('Fs_hz', 9000, 5000, 'above')]);
  });

  it('reports nothing for a value inside its band', () => {
    expect(rangeIssues({ Qts: 0.4, Fs_hz: 45 })).toEqual([]);
  });

  // Every field states a band now: where nothing narrower than the entry band is known, the
  // entry band IS the plausible band, so there is no "checked against nothing" case left. A
  // field the scraper never researched is still held to what the input would accept.
  it('holds a field with no researched band to the one its input enforces', () => {
    expect(rangeIssues({ Gloss: -50 })).toEqual([engine.issues.outOfRange('Gloss', -50, 0, 'below')]);
  });

  // Bands the scraper's deleted `semantic_dq` held that openisd lacked
  // (winisd_tools BUG_20260823_f4-deleted-semantic-dq-range-calc-marks-no-longer-stamped).
  it('holds an entered speed of sound to 300 - 360 m/s', () => {
    expect(rangeIssues({ c_m_per_s: 250 })).toEqual([engine.issues.outOfRange('c_m_per_s', 250, 300, 'below')]);
  });

  it('holds an entered air density to 0.9 - 1.5 kg/m³', () => {
    expect(rangeIssues({ roo_kg_per_m3: 2 })).toEqual([engine.issues.outOfRange('roo_kg_per_m3', 2, 1.5, 'above')]);
  });

  it('holds an entered reference efficiency to a fraction no greater than 1', () => {
    expect(rangeIssues({ no: 3 })).toEqual([engine.issues.outOfRange('no', 3, 1, 'above')]);
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
