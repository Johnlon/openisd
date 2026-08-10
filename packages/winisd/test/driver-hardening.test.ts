/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/driver-database/spec.md?html
 */
/**
 * @openisd/winisd — the Driver ADT must not smuggle a non-finite Q past the engine's
 * input guard (CODE_REVIEW.md §11, CODE_REVIEW/ENGINE_HARDENING.md).
 *
 * Why this needs its own file rather than living with the engine's own guard tests: the
 * ADT runs `solveConsistencyGroup` on the entered values FIRST and hands the RESULT to
 * `deriveDriver`. So the engine sees an already-partly-solved bag, and any non-finite Q
 * the group solver fabricates arrives looking like a supplied parameter. This is the live
 * UI path — the editors go through the ADT, not through `deriveDriver` directly — so an
 * engine-only test cannot cover it.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Driver } from '@openisd/winisd';

/** Everything a driver needs except the Q trio, which each test supplies. */
function withoutQs(): Driver {
  const d = new Driver();
  d.enter('Fs', 37);
  d.enter('Vas', 0.030);
  d.enter('Sd', 0.0133);
  d.enter('Re', 5.6);
  d.enter('Xmax', 0.005);
  d.enter('Pe', 60);
  return d;
}

const errorFields = (d: Driver): string[] =>
  d.errors().filter(e => e.level === 'error').map(e => e.field);

describe('Driver ADT — an inconsistent Q pair is rejected on the live editor path', () => {
  it('Qms equal to Qts is blocked, not solved into an infinite Qes', () => {
    // Qes = Qts·Qms/(Qms−Qts) divides by zero here. Left unguarded the ADT produced
    // Qes = Infinity, reported no error, and returned a driver whose Bl was 0 — every
    // chart a flat −200 dB line with nothing to explain it.
    const d = withoutQs();
    d.enter('Qts', 0.5);
    d.enter('Qms', 0.5);

    assert.ok(errorFields(d).includes('Qms'), 'the ADT must surface a blocking error naming Qms');
    assert.equal(d.toDriver(), null, 'an inconsistent driver must not be handed to the sweep');
  });

  it('the group solver leaves Qes unsolved rather than writing a non-finite value into it', () => {
    const d = withoutQs();
    d.enter('Qts', 0.5);
    d.enter('Qms', 0.5);
    const qes = d.cell('Qes').value;
    assert.ok(qes == null || Number.isFinite(qes),
      `Qes must be absent or finite, never Infinity — got ${String(qes)}`);
  });

  it('Qms below Qts is blocked — the derived Qes would be negative', () => {
    const d = withoutQs();
    d.enter('Qts', 0.6);
    d.enter('Qms', 0.4);
    assert.ok(errorFields(d).includes('Qms'), 'an inverted pair must be reported against Qms');
    assert.equal(d.toDriver(), null, 'a negative Qes must never reach the circuit');
  });

  it('a consistent pair still derives normally — the guard blocks bad data, not the feature', () => {
    const d = withoutQs();
    d.enter('Qts', 0.38);
    d.enter('Qms', 7.0);

    assert.deepEqual(errorFields(d), [], 'a physically consistent Q pair must raise no error');
    const drv = d.toDriver();
    assert.ok(drv, 'the driver must derive');
    assert.ok(Number.isFinite(drv.Qes) && drv.Qes > 0, `Qes must be finite and positive, got ${drv.Qes}`);
    assert.ok(Number.isFinite(drv.Bl) && drv.Bl > 0, `Bl must be finite and positive, got ${drv.Bl}`);
  });
});
