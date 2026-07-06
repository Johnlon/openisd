/**
 * @openisd/winisd — Driver ADT (class) behaviour.
 *
 * Seam under test: the Driver public API — enter, clear, cell(field), errors(),
 * subscribe(listener). This is the E/C/N provenance model (docs/DRIVER_ADT_DESIGN.md):
 * the only mutation path is enter/clear, and E/C/N is derived, never settable directly.
 *
 * Framework-free reactivity: the class carries its own subscribe() observer and must
 * NOT import Vue or any UI framework (ARCHITECTURE.md AD-6; keep arrows pointing up).
 *
 * Expected values come from independent sources: the closed-form Q combination
 * (Qts = Qes·Qms/(Qes+Qms)) and WinISD's E/C/N semantics — not from the code under test.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Driver } from '@openisd/winisd';

// A complete, valid T/S input set (two Q's entered → Qts derived).
function fullDriver(): Driver {
  const d = new Driver();
  d.enter('Fs', 37);
  d.enter('Qes', 0.40);
  d.enter('Qms', 7.0);
  d.enter('Vas', 0.030);
  d.enter('Sd', 0.0133);
  d.enter('Re', 5.6);
  return d;
}

describe('Driver — enter marks a field E', () => {
  it('enter(Fs, 37) → cell(Fs) is { value: 37, state: "E" }', () => {
    const d = new Driver();
    d.enter('Fs', 37);
    const c = d.cell('Fs');
    assert.equal(c.value, 37);
    assert.equal(c.state, 'E');
  });

  it('a field never entered reads state "N" with no value', () => {
    const d = new Driver();
    const c = d.cell('Fs');
    assert.equal(c.state, 'N');
    assert.equal(c.value, undefined);
  });
});

describe('Driver — derived fields read C; clear reverts C or N', () => {
  it('with Qes+Qms entered, the third Q (Qts) is computed → state "C" and the closed-form value', () => {
    const d = fullDriver();
    const c = d.cell('Qts');
    assert.equal(c.state, 'C', 'Qts was not entered, it is derived → C');
    // Independent source of truth: Qts = Qes·Qms/(Qes+Qms) = 0.4·7/7.4
    const expected = (0.40 * 7.0) / (0.40 + 7.0);
    assert.ok(Math.abs((c.value as number) - expected) < 1e-12,
      `Qts should be ${expected}, got ${c.value}`);
  });

  it('clearing an OVERRIDE of a derivable field reverts it to C with the recomputed value', () => {
    const d = fullDriver();
    d.enter('Qts', 0.999);            // override the normally-derived Qts → E
    assert.equal(d.cell('Qts').state, 'E');
    assert.equal(d.cell('Qts').value, 0.999);
    d.clear('Qts');                   // revert
    assert.equal(d.cell('Qts').state, 'C', 'still derivable from Qes+Qms → C');
    const expected = (0.40 * 7.0) / (0.40 + 7.0);
    assert.ok(Math.abs((d.cell('Qts').value as number) - expected) < 1e-12);
  });

  it('clearing a field with no fallback derivation reverts it to N', () => {
    const d = new Driver();
    d.enter('Fs', 37);
    assert.equal(d.cell('Fs').state, 'E');
    d.clear('Fs');
    assert.equal(d.cell('Fs').state, 'N', 'nothing derives Fs → N');
    assert.equal(d.cell('Fs').value, undefined);
  });
});

describe('Driver — fixed-E override (WinISD semantics)', () => {
  it('entering a normally-derived field (Cms) marks it E and the entered value sticks', () => {
    const d = fullDriver();
    // Without an override, Cms is computed (C) from Vas/Sd.
    assert.equal(d.cell('Cms').state, 'C');
    const computed = d.cell('Cms').value as number;
    // Override it with a deliberately different value.
    d.enter('Cms', computed * 2);
    assert.equal(d.cell('Cms').state, 'E', 'overridden derived field is now E');
    assert.equal(d.cell('Cms').value, computed * 2, 'entered value sticks, not recomputed');
  });
});

describe('Driver — alias-aware per-field errors', () => {
  it('with no Sd, cell("Dia").error surfaces the Sd requirement (aliased)', () => {
    const d = new Driver();          // empty → Sd missing
    const e = d.cell('Dia').error;
    assert.ok(e, 'Dia must carry the Sd requirement error');
    assert.equal(e.field, 'Sd');
    assert.equal(e.level, 'error');
  });

  it('with fewer than two Q entered, the "need two Q" error surfaces on Qms, Qes, and Qts alike', () => {
    const d = new Driver();
    d.enter('Fs', 37); d.enter('Vas', 0.030); d.enter('Sd', 0.0133); d.enter('Re', 5.6);
    d.enter('Qts', 0.38);            // only one Q
    for (const q of ['Qms', 'Qes', 'Qts']) {
      const e = d.cell(q).error;
      assert.ok(e, `${q} must carry the two-Q requirement`);
      assert.match(e.message, /two Q/i, `${q} error should mention needing two Q parameters`);
    }
  });

  it('errors() aggregates the whole-driver blocking errors (Apply gate)', () => {
    const d = new Driver();          // empty
    const errs = d.errors();
    assert.ok(errs.some(e => e.level === 'error' && e.field === 'Fs'), 'Fs required');
    assert.ok(errs.some(e => e.level === 'error' && e.field === 'Sd'), 'Sd required');
  });
});

describe('Driver — framework-free reactivity (subscribe)', () => {
  it('subscribe(fn) fires fn on enter and on clear; unsubscribe stops it', () => {
    const d = new Driver();
    let calls = 0;
    const unsub = d.subscribe(() => { calls++; });
    d.enter('Fs', 37);
    assert.equal(calls, 1, 'enter notifies');
    d.clear('Fs');
    assert.equal(calls, 2, 'clear notifies');
    unsub();
    d.enter('Fs', 40);
    assert.equal(calls, 2, 'no notification after unsubscribe');
  });
});
