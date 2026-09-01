/**
 * `driverAddedMass` — driver-side cone mass through the sweep (WinISD parity,
 * docs/research/WINISD_PARITY.md). Adding mass to the active driver's cone raises Mms, lowering
 * Fs and raising Q's, holding the suspension (Cms, Rms), motor (Bl), Re and Sd fixed. Madd=0
 * must be an exact no-op so every existing golden stays byte-identical.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '../../engine/index.js';
import type { SweepParams } from '../../engine/index.js';
import type { SweepResult } from '../../engine/index.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.5e-3;

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

function drv() {
  const q = engine.solveConsistencyGroup({ Fs_hz: 40, Qes: 0.45, Qms: 4, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 6 });
  // `sweep` refuses a driver missing any of these. The terminal pair is never stated: the solver
  // derives it from the `Re_ohm`/`BL_Tm` it settles on, so a fixture proves them by checking.
  for (const q_name of ['Sd_m2', 'Cms_m_per_N', 'Mms_kg', 'Rms_kg_per_s', 'Re_terminal_ohm', 'BL_terminal_Tm'] as const) {
    assert.equal(typeof q[q_name], 'number', `fixture lacks ${q_name}, which sweep() requires`);
  }
  return q;
}

describe('driverAddedMass — driver-side cone mass', () => {
  it('through sweep(): added mass slides the impedance-magnitude peak DOWN; Madd=0 is byte-identical', () => {
    const d = drv();
    const P: SweepParams = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 500, N: 400 };
    const peakF = (r: SweepResult) => r.fs[r.zmag.indexOf(Math.max(...r.zmag))];
    const base  = engine.sweep(d, LE_H, 'sealed', P).value!;
    const heavy = engine.sweep(d, LE_H, 'sealed', { ...P, driverAddedMass: 0.05 }).value!;
    assert.ok(peakF(heavy) < peakF(base), `heavy peak ${peakF(heavy)} < base ${peakF(base)}`);
    const zero = engine.sweep(d, LE_H, 'sealed', { ...P, driverAddedMass: 0 }).value!;
    assert.deepEqual(zero.zmag, base.zmag, 'driverAddedMass=0 must be byte-identical to absent');
  });
});
