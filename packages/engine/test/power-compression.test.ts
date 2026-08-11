/**
 * Voice-coil thermal power compression (WinISD parity, WINISD.md §12c).
 * As the coil heats, Re rises: Re_hot = Re·(1 + alfaVC·ΔT). The same drive voltage then
 * pushes less current → SPL drops and the impedance floor rises. ΔT=0 (or alfaVC=0) must be
 * an exact no-op so existing goldens stay byte-identical.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveDriver, hotRe, sweep } from '../src/index.js';
import type { Driver, SweepResult } from '../src/index.js';

function drv(): Driver {
  const r = deriveDriver({ Fs: 40, Qes: 0.45, Qms: 4, Vas: 0.03, Sd: 0.0133, Re: 6, Le: 0.5e-3 });
  assert.ok(r.value, `fixture derives: ${JSON.stringify(r.errors)}`);
  return r.value;
}

describe('hotRe — voice-coil resistance vs temperature', () => {
  it('Re·(1 + alfaVC·ΔT); exact no-op at ΔT=0 or alfaVC=0', () => {
    assert.ok(Math.abs(hotRe(6, 0.0039, 100) - 8.34) < 1e-9, 'copper +100 K → 6·1.39 = 8.34 Ω');
    assert.equal(hotRe(6, 0.0039, 0), 6);   // no temp rise
    assert.equal(hotRe(6, 0, 100), 6);      // no coefficient
  });
});

describe('power compression through sweep()', () => {
  it('a temp rise lifts the impedance floor and lowers SPL; ΔT=0 is byte-identical', () => {
    const d = drv();
    const P = { Vb: 0.03, eg: 2.83, fmin: 10, fmax: 500, N: 400 };
    const cold = sweep(d, 'sealed', P);
    const hot  = sweep(d, 'sealed', { ...P, vcTempRise: 100, alfaVC: 0.0039 });
    assert.ok(Math.min(...hot.zmag) > Math.min(...cold.zmag), 'impedance floor rises with hot Re');
    const iRef = cold.fs.length - 1; // a high, above-resonance reference point
    assert.ok(hot.spl[iRef] < cold.spl[iRef], `SPL drops with hot Re (${hot.spl[iRef]} < ${cold.spl[iRef]})`);
    const zeroT: SweepResult = sweep(d, 'sealed', { ...P, vcTempRise: 0, alfaVC: 0.0039 });
    assert.deepEqual(zeroT.zmag, cold.zmag, 'vcTempRise=0 must be byte-identical to absent');
  });
});
