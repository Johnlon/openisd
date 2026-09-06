/**
 * Unit tests for the WinISD Advanced-pane simulation options and the absent-Le
 * defect they surfaced. See PLAN_ADVANCED_SIM_OPTIONS.md.
 *
 * Covered here:
 *   - absent Le must not poison the electrical impedance with NaN (bug fix)
 *   - Rg placement: 'at driver side' (per-driver) vs at the amplifier (common)
 *   - transmission-line port model vs the lumped port mass, through the sweep
 *   - force-flat response (auto-EQ) and its boost clamp
 *   - Xmax-limited SPL curve
 *
 * Run: npm run test:unit
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { Engine } from '../../engine/index.js';
import type { SolverQuantities } from '../../engine/index.js';
import type { SweepParams } from '../../engine/index.js';

/** Voice-coil inductance for the fixtures below. Not a solver quantity — nothing
 *  derives it — so it reaches `sweep` on its own, and only the impedance plot reads it. */
const LE_H = 0.70e-3;

/** The engine's one door: every calculation below is a method on this object. */
const engine = new Engine();

// Reference driver — the demo 6.5" woofer (store.DEFAULT_DRIVER), which every other
// engine test also uses, so a failure here is about the option under test, not the driver.
const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};
/** The solver never refuses — an underdetermined driver simply has fewer known values, and
 *  `sweep` is what reports that it cannot be simulated. */
const derive = (raw: Record<string, number>): SolverQuantities => engine.solveConsistencyGroup({
  Fs_hz: raw.Fs, Qts: raw.Qts, Qes: raw.Qes, Qms: raw.Qms, Vas_m3: raw.Vas,
  Sd_m2: raw.Sd, Re_ohm: raw.Re, Xmax_m: raw.Xmax, Pe_W: raw.Pe, Znom_ohm: raw.Znom,
});
const DRV = derive(RAW);

// A vented box tuned near the driver's Fs, with a long-ish port so its pipe
// resonance c/(2·Leff) lands inside the sweep range and the TL model has something to show.
const SP   = Math.PI * (0.05 / 2) ** 2;          // 50 mm round port
const LEFF = 0.30 + 0.732 * 0.05;                // 300 mm cut length + one-flanged end correction
const VENTED: SweepParams = { Vb: 0.030, eg: 2.83, Sp: SP, Leff: LEFF, fmin: 10, fmax: 2000, N: 400 };

describe('absent Le — the impedance plot must stay finite (BUG)', () => {
  // Before the fix: circuit.ts evaluated `w * drv.Le!` with Le === undefined, so Zcoil
  // and therefore Zel were NaN at every frequency, and classifyFinite reported the
  // misleading "check the box volume and driver parameters" error.
  const rawNoLe = { ...RAW };
  delete rawNoLe.Le;

  it('a driver with no Le still simulates — Le is optional, not required', () => {
    // `sweep` is where this is answered. There is no separate derive-and-validate step: the
    // validation lives in the method that does the work, so the sweep's own Result says both
    // whether a curve came out and what stopped it if none did.
    const { value, errors } = engine.sweep(
      derive(rawNoLe), undefined, 'sealed', { Vb: 0.030, eg: 2.83, fmin: 20, fmax: 200, N: 8 });
    assert.ok(value, 'driver with no Le should still sweep');
    assert.equal(errors.filter(e => e.level === 'error').length, 0);
  });

  it('sweep produces a finite impedance curve when Le is absent', () => {
    const sw = engine.sweep(derive(rawNoLe), undefined, 'sealed', { Vb: 0.030, eg: 2.83, fmin: 20, fmax: 200, N: 8 }).value!;
    for (let i = 0; i < sw.fs.length; i++) {
      assert.ok(Number.isFinite(sw.zmag[i]), `zmag[${i}] must be finite at ${sw.fs[i]} Hz, got ${sw.zmag[i]}`);
      assert.ok(Number.isFinite(sw.zph[i]),  `zph[${i}] must be finite at ${sw.fs[i]} Hz, got ${sw.zph[i]}`);
    }
  });

  it('absent Le is exactly equivalent to Le = 0 (it is a missing inductor, not a missing driver)', () => {
    const P: SweepParams = { Vb: 0.030, eg: 2.83, fmin: 20, fmax: 200, N: 8 };
    const noLe   = engine.sweep(derive(rawNoLe), undefined, 'sealed', P).value!;
    const zeroLe = engine.sweep(derive(RAW), 0, 'sealed', P).value!;
    for (let i = 0; i < noLe.fs.length; i++)
      assert.equal(noLe.zmag[i], zeroLe.zmag[i], `zmag[${i}] must match the explicit Le=0 driver`);
  });
});

describe("Rg placement — 'Rg is at driver side' (WinISD Advanced)", () => {
  const base = (over: Partial<SweepParams>): SweepParams =>
    ({ Vb: 0.030, eg: 2.83, Rs: 1.0, fmin: 20, fmax: 200, N: 16, ...over });

  it('is an exact no-op for a single driver — one Rg in series is one Rg in series', () => {
    const atDriver = engine.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 1, rgAtDriverSide: true })).value!;
    const atAmp    = engine.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 1, rgAtDriverSide: false })).value!;
    for (let i = 0; i < atDriver.fs.length; i++) {
      assert.equal(atDriver.spl[i],  atAmp.spl[i],  `spl[${i}] must be bit-identical at nDrivers=1`);
      assert.equal(atDriver.zmag[i], atAmp.zmag[i], `zmag[${i}] must be bit-identical at nDrivers=1`);
    }
  });

  it('two drivers in parallel: Rg at the amplifier is the heavier loss, so SPL is lower', () => {
    // At the driver side each driver carries its own Rg, so the array's series resistance
    // is Rg/2. At the amplifier one Rg carries the whole current — 2× the series resistance.
    const P = { nDrivers: 2, wiring: 'parallel' as const };
    const atDriver = engine.sweep(DRV, LE_H, 'sealed', base({ ...P, rgAtDriverSide: true })).value!;
    const atAmp    = engine.sweep(DRV, LE_H, 'sealed', base({ ...P, rgAtDriverSide: false })).value!;
    for (let i = 0; i < atDriver.fs.length; i++)
      assert.ok(atAmp.spl[i] < atDriver.spl[i],
        `at ${atDriver.fs[i].toFixed(1)} Hz: amp-side SPL ${atAmp.spl[i]} should be below driver-side ${atDriver.spl[i]}`);
  });

  it('defaults to the driver side when unspecified (backward compatible)', () => {
    const dflt    = engine.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 2 })).value!;
    const explicit = engine.sweep(DRV, LE_H, 'sealed', base({ nDrivers: 2, rgAtDriverSide: true })).value!;
    for (let i = 0; i < dflt.fs.length; i++)
      assert.equal(dflt.spl[i], explicit.spl[i], `spl[${i}] default must equal rgAtDriverSide:true`);
  });
});

describe('transmission-line port model (WinISD Advanced: TLPorts)', () => {
  const F_PIPE = engine.airFor({}).c / (2 * LEFF);   // half-wave fundamental of the duct — the same figure the
                                   // the UI already reports as "1st port resonance"

  it('changes the system output around the pipe resonance — the toggle is not cosmetic', () => {
    // The collapsed port impedance dumps volume velocity through the duct, so the port air
    // velocity is where the difference is unmistakable; the far-field SPL effect is smaller
    // because the driver dominates the total output that far above the passband.
    const lumped = engine.sweep(DRV, LE_H, 'vented', { ...VENTED, tlPortModel: false }).value!;
    const tl     = engine.sweep(DRV, LE_H, 'vented', { ...VENTED, tlPortModel: true  }).value!;
    let worstSpl = 0, worstPv = 0;
    for (let i = 0; i < lumped.fs.length; i++)
      if (lumped.fs[i] > F_PIPE * 0.6 && lumped.fs[i] < F_PIPE * 1.6) {
        worstSpl = Math.max(worstSpl, Math.abs(tl.spl[i] - lumped.spl[i]));
        worstPv  = Math.max(worstPv, tl.pv[i] / Math.max(lumped.pv[i], 1e-12));
      }
    assert.ok(worstPv > 10, `TL port air velocity should exceed the lumped model 10-fold near ` +
      `${F_PIPE.toFixed(0)} Hz, got ${worstPv.toFixed(1)}×`);
    assert.ok(worstSpl > 0.5, `TL and lumped SPL should diverge by more than 0.5 dB near ` +
      `${F_PIPE.toFixed(0)} Hz, got ${worstSpl.toFixed(3)} dB`);
  });

  it('is off by default — an unspecified flag reproduces the lumped model exactly', () => {
    const dflt   = engine.sweep(DRV, LE_H, 'vented', VENTED).value!;
    const lumped = engine.sweep(DRV, LE_H, 'vented', { ...VENTED, tlPortModel: false }).value!;
    for (let i = 0; i < dflt.fs.length; i++)
      assert.equal(dflt.spl[i], lumped.spl[i], `spl[${i}] default must equal tlPortModel:false`);
  });
});

describe('force flat response (WinISD Advanced: FlatResponse)', () => {
  const FLAT: SweepParams = { ...VENTED, forceFlatResponse: true, flatMaxBoostDb: 60 };

  it('flattens the SPL curve to the passband reference wherever the clamp does not bind', () => {
    const flat = engine.sweep(DRV, LE_H, 'vented', FLAT).value!;
    const ref  = engine.passbandRef(engine.sweep(DRV, LE_H, 'vented', VENTED).value!.spl);
    for (let i = 0; i < flat.fs.length; i++)
      assert.ok(Math.abs(flat.spl[i] - ref) < 1e-9,
        `at ${flat.fs[i].toFixed(1)} Hz: SPL ${flat.spl[i]} should equal the reference ${ref}`);
  });

  it('charges the EQ boost to the excursion — flattening a rolloff is not free', () => {
    const plain = engine.sweep(DRV, LE_H, 'vented', VENTED).value!;
    const flat  = engine.sweep(DRV, LE_H, 'vented', FLAT).value!;
    let boosted = 0;
    for (let i = 0; i < plain.fs.length; i++) {
      assert.ok(flat.exc[i] >= plain.exc[i] - 1e-12,
        `at ${plain.fs[i].toFixed(1)} Hz: excursion must not fall below the un-EQ'd ${plain.exc[i]}`);
      if (flat.exc[i] > plain.exc[i] * 1.01) boosted++;
    }
    assert.ok(boosted > 0, 'at least one frequency should show a materially higher excursion');
  });

  it('leaves the electrical impedance untouched — the EQ is line-level, upstream of the amp', () => {
    const plain = engine.sweep(DRV, LE_H, 'vented', VENTED).value!;
    const flat  = engine.sweep(DRV, LE_H, 'vented', FLAT).value!;
    for (let i = 0; i < plain.fs.length; i++)
      assert.equal(flat.zmag[i], plain.zmag[i], `zmag[${i}] must be unchanged by a line-level gain`);
  });

  it('clamps the boost and reports the frequency where the clamp binds', () => {
    const clamped = engine.sweep(DRV, LE_H, 'vented', { ...VENTED, forceFlatResponse: true, flatMaxBoostDb: 6 }).value!;
    const plain   = engine.sweep(DRV, LE_H, 'vented', VENTED).value!;
    const ref     = engine.passbandRef(plain.spl);
    for (let i = 0; i < clamped.fs.length; i++)
      assert.ok(clamped.spl[i] <= plain.spl[i] + 6 + 1e-9,
        `at ${clamped.fs[i].toFixed(1)} Hz: boost ${clamped.spl[i] - plain.spl[i]} exceeds the 6 dB clamp`);
    assert.ok(clamped.flatClamped != null, 'the clamp bound, so flatClamped must name a frequency');
    assert.ok(clamped.spl[0] < ref - 1e-9, 'the deep rolloff cannot reach the reference under a 6 dB clamp');
    const issue = engine.classifyFlatClamp(clamped);
    assert.ok(issue && issue.level === 'warn', 'a bound clamp must surface a warn, never silently');
  });

  it('is off by default — an unspecified flag changes nothing', () => {
    const dflt  = engine.sweep(DRV, LE_H, 'vented', VENTED).value!;
    const plain = engine.sweep(DRV, LE_H, 'vented', { ...VENTED, forceFlatResponse: false }).value!;
    for (let i = 0; i < dflt.fs.length; i++)
      assert.equal(dflt.spl[i], plain.spl[i], `spl[${i}] default must equal forceFlatResponse:false`);
    assert.equal(dflt.flatClamped, null, 'no clamp without the flag');
    assert.equal(engine.classifyFlatClamp(dflt), null);
  });
});

describe('Xmax-limited SPL (WinISD Advanced: SPL graph is Xmax limited)', () => {
  it('equals the plain SPL when the drive never reaches Xmax', () => {
    const quiet = engine.sweep(DRV, LE_H, 'vented', { ...VENTED, eg: 0.01 }).value!;
    for (let i = 0; i < quiet.fs.length; i++) {
      assert.equal(quiet.splXlimCurve[i], quiet.spl[i], `splXlim[${i}] must equal spl[${i}] below Xmax`);
      assert.equal(quiet.xlimited[i], false, `xlimited[${i}] must be false below Xmax`);
    }
  });

  it('clamps exactly to the excursion overshoot where Xmax is exceeded', () => {
    const loud = engine.sweep(DRV, LE_H, 'vented', { ...VENTED, eg: 40 }).value!;
    let clamped = 0;
    for (let i = 0; i < loud.fs.length; i++) {
      const xPeak = loud.exc[i] / 1000;                 // exc is mm, Xmax is m
      if (xPeak > DRV.Xmax_m!) {
        clamped++;
        assert.equal(loud.xlimited[i], true, `xlimited[${i}] must be true at ${loud.fs[i].toFixed(1)} Hz`);
        const expected = loud.spl[i] + 20 * Math.log10(DRV.Xmax_m! / xPeak);
        assert.ok(Math.abs(loud.splXlimCurve[i] - expected) < 1e-9,
          `at ${loud.fs[i].toFixed(1)} Hz: splXlim ${loud.splXlimCurve[i]} should be ${expected}`);
        assert.ok(loud.splXlimCurve[i] < loud.spl[i], 'a clamped point must sit below the unclamped SPL');
      } else {
        assert.equal(loud.splXlimCurve[i], loud.spl[i], `splXlim[${i}] must be untouched below Xmax`);
        assert.equal(loud.xlimited[i], false);
      }
    }
    assert.ok(clamped > 0, 'the 40 V drive should exceed Xmax somewhere in the sweep');
  });

  it('never limits a driver with no Xmax — an unknown limit is not a zero limit', () => {
    const noXmax = { ...RAW }; delete noXmax.Xmax;
    const sw = engine.sweep(derive(noXmax), LE_H, 'vented', { ...VENTED, eg: 40 }).value!;
    for (let i = 0; i < sw.fs.length; i++) {
      assert.equal(sw.splXlimCurve[i], sw.spl[i], `splXlim[${i}] must equal spl[${i}] with no Xmax`);
      assert.equal(sw.xlimited[i], false);
      assert.ok(Number.isFinite(sw.splXlimCurve[i]), `splXlim[${i}] must be finite, got ${sw.splXlimCurve[i]}`);
    }
  });
});

describe('passbandRef — one definition of the passband reference level', () => {
  it('ignores the -200 dB "no output" sentinel', () => {
    assert.equal(engine.passbandRef([-200, 80, 90, 85, -200]), 90);
  });
  it('returns 0 for an all-sentinel curve rather than -200', () => {
    assert.equal(engine.passbandRef([-200, -200]), 0);
  });
});
