/**
 * @openisd/winisd — Driver ADT as the single derivation authority (Phase 4a).
 *
 * The Driver must derive every field the editor displays — not just the engine's core
 * T/S set — so the UI can be a pure projection with zero duplicate math. This pins the
 * extra derivations (Sd<->Dia, Vd, η₀, SPL, c/roo defaults) and the fixed-E override
 * feeding downstream, in SI units (the Driver holds SI; the UI converts at the edges).
 *
 * Expected values come from the closed-form T/S relations and the engine's air
 * constants, not from the code under test.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { C, RHO } from '@openisd/engine';
import { Driver } from '@openisd/winisd';

// Complete core driver in SI (Vas m³, Sd m², Le H, Xmax m).
function core(): Driver {
  const d = new Driver();
  d.enter('Fs', 37);
  d.enter('Qes', 0.40);
  d.enter('Qms', 7.0);
  d.enter('Vas', 0.030);
  d.enter('Sd', 0.0133);
  d.enter('Re', 5.6);
  d.enter('Xmax', 0.005);
  return d;
}

describe('Driver — Sd ↔ Dia interchange', () => {
  it('entering Sd computes Dia = 2·√(Sd/π) as C', () => {
    const d = core();
    const c = d.cell('Dia');
    assert.equal(c.state, 'C');
    const expected = 2 * Math.sqrt(0.0133 / Math.PI);
    assert.ok(Math.abs((c.value as number) - expected) < 1e-9, `Dia ${c.value} vs ${expected}`);
  });

  it('entering Dia (and not Sd) computes Sd = π·(Dia/2)² as C', () => {
    const d = new Driver();
    d.enter('Fs', 37); d.enter('Qes', 0.40); d.enter('Qms', 7.0);
    d.enter('Vas', 0.030); d.enter('Re', 5.6);
    d.enter('Dia', 0.13);   // metres
    const c = d.cell('Sd');
    assert.equal(c.state, 'C', 'Sd derived from Dia → C');
    const expected = Math.PI * (0.13 / 2) ** 2;
    assert.ok(Math.abs((c.value as number) - expected) < 1e-9, `Sd ${c.value} vs ${expected}`);
  });
});

describe('Driver — extra derived display fields', () => {
  it('Vd = Sd·Xmax (C)', () => {
    const d = core();
    const c = d.cell('Vd');
    assert.equal(c.state, 'C');
    assert.ok(Math.abs((c.value as number) - 0.0133 * 0.005) < 1e-12);
  });

  it('η₀ (no) and SPL are computed (C) and positive', () => {
    const d = core();
    assert.equal(d.cell('no').state, 'C');
    assert.ok((d.cell('no').value as number) > 0);
    assert.equal(d.cell('SPL').state, 'C');
    // SPL = 112.1 + 10·log10(no)
    const expected = 112.1 + 10 * Math.log10(d.cell('no').value as number);
    assert.ok(Math.abs((d.cell('SPL').value as number) - expected) < 1e-9);
  });

  it('c and roo autofill to the engine air constants as C (not entered)', () => {
    const d = core();
    assert.equal(d.cell('c').state, 'C');
    assert.ok(Math.abs((d.cell('c').value as number) - C) < 1e-9);
    assert.equal(d.cell('roo').state, 'C');
    assert.ok(Math.abs((d.cell('roo').value as number) - RHO) < 1e-9);
  });
});

describe('Driver — fixed-E override feeds downstream (WinISD semantics)', () => {
  it('overriding Cms changes the computed Mms (Mms consumes the entered Cms)', () => {
    const d = core();
    const mmsBefore = d.cell('Mms').value as number;
    const cmsComputed = d.cell('Cms').value as number;
    d.enter('Cms', cmsComputed * 2);        // override Cms → E
    assert.equal(d.cell('Cms').state, 'E');
    // Mms = 1/((2π·Fs)²·Cms): doubling Cms halves Mms.
    const mmsAfter = d.cell('Mms').value as number;
    assert.ok(Math.abs(mmsAfter - mmsBefore / 2) < mmsBefore * 1e-9,
      `Mms should track the overridden Cms: ${mmsBefore} → ${mmsAfter}`);
  });

  it('overriding c marks it E and the entered value sticks', () => {
    const d = core();
    d.enter('c', 340);
    assert.equal(d.cell('c').state, 'E');
    assert.equal(d.cell('c').value, 340);
  });
});
