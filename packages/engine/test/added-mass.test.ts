/**
 * withAddedMass — driver-side cone mass (WinISD parity, WINISD.md §12c).
 * Adding mass to the active driver's cone raises Mms, lowering Fs and raising Q's, holding
 * the suspension (Cms, Rms), motor (Bl), Re and Sd fixed. Madd=0 must be an exact no-op so
 * every existing golden stays byte-identical.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveDriver, withAddedMass, sweep } from '../src/index.js';
import type { Driver, SweepResult } from '../src/index.js';

function drv(): Driver {
  const r = deriveDriver({ Fs: 40, Qes: 0.45, Qms: 4, Vas: 0.03, Sd: 0.0133, Re: 6, Le: 0.5e-3 });
  assert.ok(r.value, `fixture derives: ${JSON.stringify(r.errors)}`);
  return r.value;
}

describe('withAddedMass — driver-side cone mass', () => {
  it('Madd ≤ 0 is an exact no-op (0 and negative) — golden safety', () => {
    const d = drv();
    for (const Madd of [0, -0.01]) {
      const d0 = withAddedMass(d, Madd);
      for (const k of ['Fs', 'Mms', 'Cms', 'Rms', 'Bl', 'Re', 'Sd', 'Qts', 'Qes', 'Qms'] as const) {
        assert.equal(d0[k], d[k], `${k} must be unchanged at Madd=${Madd}`);
      }
    }
  });

  it('adds mass into Mms; Cms/Rms/Bl/Re/Sd stay fixed', () => {
    const d = drv();
    const m = withAddedMass(d, 0.05); // +50 g
    assert.ok(Math.abs(m.Mms - (d.Mms + 0.05)) < 1e-12, 'Mms += Madd');
    for (const k of ['Cms', 'Rms', 'Bl', 'Re', 'Sd'] as const) assert.ok(Math.abs(m[k] - d[k]) < 1e-12, `${k} fixed`);
  });

  it('lowers Fs by √(Mms/(Mms+Madd)) and raises Qts (the WinISD oracle relationship, §12c)', () => {
    const d = drv();
    const Madd = 0.05;
    const m = withAddedMass(d, Madd);
    const expectedFs = d.Fs * Math.sqrt(d.Mms / (d.Mms + Madd));
    assert.ok(Math.abs(m.Fs - expectedFs) < 1e-9, `Fs ${m.Fs} vs ${expectedFs}`);
    assert.ok(m.Qts > d.Qts, 'Qts rises with added mass');
    // Oracle magnitude: making Mms 7.84× (add 6.84·Mms) gives Fs ×0.357 — WinISD's 70→25 Hz.
    const big = withAddedMass(d, d.Mms * 6.84);
    assert.ok(Math.abs(big.Fs / d.Fs - 0.3571) < 0.003, `Fs ratio ${big.Fs / d.Fs} (expect ≈0.357)`);
  });

  it('through sweep(): added mass slides the impedance-magnitude peak DOWN; Madd=0 is byte-identical', () => {
    const d = drv();
    const P = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 500, N: 400 };
    const peakF = (r: SweepResult) => r.fs[r.zmag.indexOf(Math.max(...r.zmag))];
    const base  = sweep(d, 'sealed', P);
    const heavy = sweep(d, 'sealed', { ...P, driverAddedMass: 0.05 });
    assert.ok(peakF(heavy) < peakF(base), `heavy peak ${peakF(heavy)} < base ${peakF(base)}`);
    const zero = sweep(d, 'sealed', { ...P, driverAddedMass: 0 });
    assert.deepEqual(zero.zmag, base.zmag, 'driverAddedMass=0 must be byte-identical to absent');
  });
});
