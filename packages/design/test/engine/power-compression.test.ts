/**
 * Voice-coil thermal power compression (WinISD parity, docs/research/WINISD_PARITY.md).
 * As the coil heats, Re rises: Re_hot = Re·(1 + alfaVC·ΔT). The same drive voltage then
 * pushes less current → SPL drops and the impedance floor rises. ΔT=0 (or alfaVC=0) must be
 * an exact no-op so existing goldens stay byte-identical.
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

describe('power compression through sweep()', () => {
  it('a temp rise lifts the impedance floor and lowers SPL; ΔT=0 is byte-identical', () => {
    const d = drv();
    const P: SweepParams = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 500, N: 400 };
    const cold = engine.sweep(d, LE_H, 'sealed', P).value!;
    const hot  = engine.sweep(d, LE_H, 'sealed', { ...P, vcTempRise: 100, alfaVC: 0.0039 }).value!;
    assert.ok(Math.min(...hot.zmag) > Math.min(...cold.zmag), 'impedance floor rises with hot Re');
    const iRef = cold.fs.length - 1; // a high, above-resonance reference point
    assert.ok(hot.spl[iRef] < cold.spl[iRef], `SPL drops with hot Re (${hot.spl[iRef]} < ${cold.spl[iRef]})`);
    const zeroT: SweepResult = engine.sweep(d, LE_H, 'sealed', { ...P, vcTempRise: 0, alfaVC: 0.0039 }).value!;
    assert.deepEqual(zeroT.zmag, cold.zmag, 'vcTempRise=0 must be byte-identical to absent');
  });
});
