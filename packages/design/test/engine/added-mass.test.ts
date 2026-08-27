/**
 * `driverAddedMass` — driver-side cone mass through the sweep (WinISD parity,
 * docs/research/WINISD_PARITY.md). Adding mass to the active driver's cone raises Mms, lowering
 * Fs and raising Q's, holding the suspension (Cms, Rms), motor (Bl), Re and Sd fixed. Madd=0
 * must be an exact no-op so every existing golden stays byte-identical.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '../../engine/index.js';
import type { EngineDriver, SweepResult } from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

function drv(): EngineDriver {
  const r = engine.deriveEngineDriver({ Fs: 40, Qes: 0.45, Qms: 4, Vas: 0.03, Sd: 0.0133, Re: 6, Le: 0.5e-3 });
  assert.ok(r.value, `fixture derives: ${JSON.stringify(r.errors)}`);
  return r.value;
}

describe('driverAddedMass — driver-side cone mass', () => {
  it('through sweep(): added mass slides the impedance-magnitude peak DOWN; Madd=0 is byte-identical', () => {
    const d = drv();
    const P = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 500, N: 400 };
    const peakF = (r: SweepResult) => r.fs[r.zmag.indexOf(Math.max(...r.zmag))];
    const base  = engine.sweep(d, 'sealed', P);
    const heavy = engine.sweep(d, 'sealed', { ...P, driverAddedMass: 0.05 });
    assert.ok(peakF(heavy) < peakF(base), `heavy peak ${peakF(heavy)} < base ${peakF(base)}`);
    const zero = engine.sweep(d, 'sealed', { ...P, driverAddedMass: 0 });
    assert.deepEqual(zero.zmag, base.zmag, 'driverAddedMass=0 must be byte-identical to absent');
  });
});
