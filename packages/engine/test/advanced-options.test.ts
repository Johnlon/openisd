/**
 * Unit tests for the WinISD Advanced-pane simulation options and the absent-Le
 * defect they surfaced. See PLAN_ADVANCED_SIM_OPTIONS.md.
 *
 * Covered here:
 *   - absent Le must not poison the electrical impedance with NaN (bug fix)
 *   - Rg placement: 'at driver side' (per-driver) vs at the amplifier (common)
 *   - transmission-line port model vs the lumped port mass
 *   - force-flat response (auto-EQ) and its boost clamp
 *   - Xmax-limited SPL curve
 *
 * Run: npm run test:unit
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveEngineDriver, solve, sweep, portImpedance, cAbs, cSub, cTanh, cx, C,
         passbandRef, classifyFlatClamp } from '@openisd/engine';
import type { SweepParams } from '@openisd/engine';

// Reference driver — the demo 6.5" woofer (store.DEFAULT_DRIVER), which every other
// engine test also uses, so a failure here is about the option under test, not the driver.
const RAW: Record<string, number> = {
  Fs: 37, Qts: 0.378, Qes: 0.40, Qms: 7.0, Vas: 0.0300,
  Sd: 0.0133, Re: 5.6, Le: 0.70e-3, Xmax: 0.0050, Pe: 60, Znom: 8,
};
const derive = (raw: Record<string, number>) => {
  const { value, errors } = deriveEngineDriver(raw);
  if (!value) throw new Error('driver derivation failed: ' + errors.map(e => e.message).join('; '));
  return value;
};
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

  it('deriveEngineDriver accepts a driver with no Le (Le is optional, not required)', () => {
    const { value, errors } = deriveEngineDriver(rawNoLe);
    assert.ok(value, 'driver with no Le should still derive');
    assert.equal(errors.filter(e => e.level === 'error').length, 0);
  });

  it('sweep produces a finite impedance curve when Le is absent', () => {
    const sw = sweep(derive(rawNoLe), 'sealed', { Vb: 0.030, eg: 2.83, fmin: 20, fmax: 200, N: 8 });
    for (let i = 0; i < sw.fs.length; i++) {
      assert.ok(Number.isFinite(sw.zmag[i]), `zmag[${i}] must be finite at ${sw.fs[i]} Hz, got ${sw.zmag[i]}`);
      assert.ok(Number.isFinite(sw.zph[i]),  `zph[${i}] must be finite at ${sw.fs[i]} Hz, got ${sw.zph[i]}`);
    }
  });

  it('absent Le is exactly equivalent to Le = 0 (it is a missing inductor, not a missing driver)', () => {
    const P: SweepParams = { Vb: 0.030, eg: 2.83, fmin: 20, fmax: 200, N: 8 };
    const noLe   = sweep(derive(rawNoLe),           'sealed', P);
    const zeroLe = sweep(derive({ ...RAW, Le: 0 }), 'sealed', P);
    for (let i = 0; i < noLe.fs.length; i++)
      assert.equal(noLe.zmag[i], zeroLe.zmag[i], `zmag[${i}] must match the explicit Le=0 driver`);
  });
});

describe("Rg placement — 'Rg is at driver side' (WinISD Advanced)", () => {
  const base = (over: Partial<SweepParams>): SweepParams =>
    ({ Vb: 0.030, eg: 2.83, Rs: 1.0, fmin: 20, fmax: 200, N: 16, ...over });

  it('is an exact no-op for a single driver — one Rg in series is one Rg in series', () => {
    const atDriver = sweep(DRV, 'sealed', base({ nDrivers: 1, rgAtDriverSide: true }));
    const atAmp    = sweep(DRV, 'sealed', base({ nDrivers: 1, rgAtDriverSide: false }));
    for (let i = 0; i < atDriver.fs.length; i++) {
      assert.equal(atDriver.spl[i],  atAmp.spl[i],  `spl[${i}] must be bit-identical at nDrivers=1`);
      assert.equal(atDriver.zmag[i], atAmp.zmag[i], `zmag[${i}] must be bit-identical at nDrivers=1`);
    }
  });

  it('two drivers in parallel: Rg at the amplifier is the heavier loss, so SPL is lower', () => {
    // At the driver side each driver carries its own Rg, so the array's series resistance
    // is Rg/2. At the amplifier one Rg carries the whole current — 2× the series resistance.
    const P = { nDrivers: 2, wiring: 'parallel' as const };
    const atDriver = sweep(DRV, 'sealed', base({ ...P, rgAtDriverSide: true }));
    const atAmp    = sweep(DRV, 'sealed', base({ ...P, rgAtDriverSide: false }));
    for (let i = 0; i < atDriver.fs.length; i++)
      assert.ok(atAmp.spl[i] < atDriver.spl[i],
        `at ${atDriver.fs[i].toFixed(1)} Hz: amp-side SPL ${atAmp.spl[i]} should be below driver-side ${atDriver.spl[i]}`);
  });

  it('two drivers in parallel: the electrical impedance differs by exactly Rg/2', () => {
    // Zel_amp = Rg + Zarray ; Zel_driver = (Re+Rg)/2 + ... = Rg/2 + Zarray  →  difference Rg/2.
    const P = { nDrivers: 2, wiring: 'parallel' as const, Rs: 1.0 };
    const f = 500;   // well above Fs, where the motional term is small but still exact algebra
    const zDriver = solve(f, DRV, 'sealed', base({ ...P, rgAtDriverSide: true }));
    const zAmp    = solve(f, DRV, 'sealed', base({ ...P, rgAtDriverSide: false }));
    assert.ok(Math.abs((zAmp.Zel.re - zDriver.Zel.re) - 0.5) < 1e-9,
      `real part should differ by Rg/2 = 0.5 Ω, got ${zAmp.Zel.re - zDriver.Zel.re}`);
  });

  it('defaults to the driver side when unspecified (backward compatible)', () => {
    const dflt    = sweep(DRV, 'sealed', base({ nDrivers: 2 }));
    const explicit = sweep(DRV, 'sealed', base({ nDrivers: 2, rgAtDriverSide: true }));
    for (let i = 0; i < dflt.fs.length; i++)
      assert.equal(dflt.spl[i], explicit.spl[i], `spl[${i}] default must equal rgAtDriverSide:true`);
  });
});

describe('cTanh — complex hyperbolic tangent', () => {
  it('matches the real-valued Math.tanh on the real axis', () => {
    for (const x of [0, 0.1, 1, 3]) {
      const t = cTanh(cx(x, 0));
      assert.ok(Math.abs(t.re - Math.tanh(x)) < 1e-12, `tanh(${x}).re = ${t.re}`);
      assert.ok(Math.abs(t.im) < 1e-12, `tanh(${x}).im should be 0, got ${t.im}`);
    }
  });

  it('tanh(j·y) = j·tan(y) on the imaginary axis', () => {
    const y = 0.7;
    const t = cTanh(cx(0, y));
    assert.ok(Math.abs(t.re) < 1e-12, `re should be 0, got ${t.re}`);
    assert.ok(Math.abs(t.im - Math.tan(y)) < 1e-12, `im should be tan(${y}) = ${Math.tan(y)}, got ${t.im}`);
  });

  it('saturates to ±1 for a large real part instead of overflowing to NaN', () => {
    const t = cTanh(cx(400, 1));
    assert.ok(Number.isFinite(t.re) && Number.isFinite(t.im), `must stay finite, got ${t.re}+${t.im}j`);
    assert.ok(Math.abs(t.re - 1) < 1e-12, `should saturate to 1, got ${t.re}`);
    const tn = cTanh(cx(-400, 1));
    assert.ok(Math.abs(tn.re + 1) < 1e-12, `should saturate to -1, got ${tn.re}`);
  });
});

describe('transmission-line port model (WinISD Advanced: TLPorts)', () => {
  const F_PIPE = C / (2 * LEFF);   // half-wave fundamental of the duct — the same figure the
                                   // the UI already reports as "1st port resonance"

  it('converges on the lumped port mass as ω→0 — the lumped model IS its low-frequency limit', () => {
    // tanh(γL) → γL as ω→0, which makes Zport → Rap + jω·Map identically. So this is an
    // identity check with a shrinking error, not a loose "looks similar" assertion: the
    // relative difference must fall roughly as f² as the frequency drops.
    const relDiff = (f: number) => {
      const w = 2 * Math.PI * f;
      const lumped = portImpedance(w, { ...VENTED, tlPortModel: false });
      const tl     = portImpedance(w, { ...VENTED, tlPortModel: true  });
      return cAbs(cSub(tl, lumped)) / cAbs(lumped);
    };
    const decade = [F_PIPE / 200, F_PIPE / 100, F_PIPE / 50, F_PIPE / 20, F_PIPE / 10];
    assert.ok(relDiff(decade[1]) < 1e-3,
      `two decades below the pipe fundamental the models should agree to 1e-3, got ${relDiff(decade[1])}`);
    // The leading error term is tanh's (γL)²/3, so halving the frequency must QUARTER the
    // difference. Monotonic shrinkage alone would pass on a wrong series expansion; the
    // second-order rate is what pins the implementation to the physics.
    for (let i = 1; i < decade.length; i++) {
      const got      = relDiff(decade[i]) / relDiff(decade[i - 1]);
      const expected = (decade[i] / decade[i - 1]) ** 2;
      assert.ok(Math.abs(got / expected - 1) < 0.1,
        `error must fall as f² towards DC: ${decade[i].toFixed(2)} Hz vs ${decade[i - 1].toFixed(2)} Hz ` +
        `gave a ratio of ${got.toFixed(3)}, expected ≈ ${expected.toFixed(3)}`);
    }
  });

  it('collapses the port impedance at the half-wave resonance — the lumped mass never can', () => {
    // A duct open at both ends is a half-wave resonator: at f = c/(2L) the line transforms
    // the (near-zero) mouth load straight through, so |Zport| collapses. The lumped mass is
    // strictly monotonic in ω, so it has no such feature anywhere.
    const zTl     = (f: number) => cAbs(portImpedance(2 * Math.PI * f, { ...VENTED, tlPortModel: true  }));
    const zLumped = (f: number) => cAbs(portImpedance(2 * Math.PI * f, { ...VENTED, tlPortModel: false }));
    const below = zTl(F_PIPE * 0.6), at = zTl(F_PIPE), above = zTl(F_PIPE * 1.6);
    assert.ok(at < below / 10 && at < above / 10,
      `TL |Zport| at ${F_PIPE.toFixed(0)} Hz (${at}) should collapse far below ${below} / ${above}`);
    assert.ok(zLumped(F_PIPE * 0.6) < zLumped(F_PIPE) && zLumped(F_PIPE) < zLumped(F_PIPE * 1.6),
      'the lumped port impedance must rise monotonically through the pipe fundamental');
  });

  it('changes the system output around the pipe resonance — the toggle is not cosmetic', () => {
    // The collapsed port impedance dumps volume velocity through the duct, so the port air
    // velocity is where the difference is unmistakable; the far-field SPL effect is smaller
    // because the driver dominates the total output that far above the passband.
    const lumped = sweep(DRV, 'vented', { ...VENTED, tlPortModel: false });
    const tl     = sweep(DRV, 'vented', { ...VENTED, tlPortModel: true  });
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
    const dflt   = sweep(DRV, 'vented', VENTED);
    const lumped = sweep(DRV, 'vented', { ...VENTED, tlPortModel: false });
    for (let i = 0; i < dflt.fs.length; i++)
      assert.equal(dflt.spl[i], lumped.spl[i], `spl[${i}] default must equal tlPortModel:false`);
  });
});

describe('force flat response (WinISD Advanced: FlatResponse)', () => {
  const FLAT: SweepParams = { ...VENTED, forceFlatResponse: true, flatMaxBoostDb: 60 };

  it('flattens the SPL curve to the passband reference wherever the clamp does not bind', () => {
    const flat = sweep(DRV, 'vented', FLAT);
    const ref  = passbandRef(sweep(DRV, 'vented', VENTED).spl);
    for (let i = 0; i < flat.fs.length; i++)
      assert.ok(Math.abs(flat.spl[i] - ref) < 1e-9,
        `at ${flat.fs[i].toFixed(1)} Hz: SPL ${flat.spl[i]} should equal the reference ${ref}`);
  });

  it('charges the EQ boost to the excursion — flattening a rolloff is not free', () => {
    const plain = sweep(DRV, 'vented', VENTED);
    const flat  = sweep(DRV, 'vented', FLAT);
    let boosted = 0;
    for (let i = 0; i < plain.fs.length; i++) {
      assert.ok(flat.exc[i] >= plain.exc[i] - 1e-12,
        `at ${plain.fs[i].toFixed(1)} Hz: excursion must not fall below the un-EQ'd ${plain.exc[i]}`);
      if (flat.exc[i] > plain.exc[i] * 1.01) boosted++;
    }
    assert.ok(boosted > 0, 'at least one frequency should show a materially higher excursion');
  });

  it('leaves the electrical impedance untouched — the EQ is line-level, upstream of the amp', () => {
    const plain = sweep(DRV, 'vented', VENTED);
    const flat  = sweep(DRV, 'vented', FLAT);
    for (let i = 0; i < plain.fs.length; i++)
      assert.equal(flat.zmag[i], plain.zmag[i], `zmag[${i}] must be unchanged by a line-level gain`);
  });

  it('clamps the boost and reports the frequency where the clamp binds', () => {
    const clamped = sweep(DRV, 'vented', { ...VENTED, forceFlatResponse: true, flatMaxBoostDb: 6 });
    const plain   = sweep(DRV, 'vented', VENTED);
    const ref     = passbandRef(plain.spl);
    for (let i = 0; i < clamped.fs.length; i++)
      assert.ok(clamped.spl[i] <= plain.spl[i] + 6 + 1e-9,
        `at ${clamped.fs[i].toFixed(1)} Hz: boost ${clamped.spl[i] - plain.spl[i]} exceeds the 6 dB clamp`);
    assert.ok(clamped.flatClamped != null, 'the clamp bound, so flatClamped must name a frequency');
    assert.ok(clamped.spl[0] < ref - 1e-9, 'the deep rolloff cannot reach the reference under a 6 dB clamp');
    const issue = classifyFlatClamp(clamped);
    assert.ok(issue && issue.level === 'warn', 'a bound clamp must surface a warn, never silently');
  });

  it('is off by default — an unspecified flag changes nothing', () => {
    const dflt  = sweep(DRV, 'vented', VENTED);
    const plain = sweep(DRV, 'vented', { ...VENTED, forceFlatResponse: false });
    for (let i = 0; i < dflt.fs.length; i++)
      assert.equal(dflt.spl[i], plain.spl[i], `spl[${i}] default must equal forceFlatResponse:false`);
    assert.equal(dflt.flatClamped, null, 'no clamp without the flag');
    assert.equal(classifyFlatClamp(dflt), null);
  });
});

describe('Xmax-limited SPL (WinISD Advanced: SPL graph is Xmax limited)', () => {
  it('equals the plain SPL when the drive never reaches Xmax', () => {
    const quiet = sweep(DRV, 'vented', { ...VENTED, eg: 0.01 });
    for (let i = 0; i < quiet.fs.length; i++) {
      assert.equal(quiet.splXlim[i], quiet.spl[i], `splXlim[${i}] must equal spl[${i}] below Xmax`);
      assert.equal(quiet.xlimited[i], false, `xlimited[${i}] must be false below Xmax`);
    }
  });

  it('clamps exactly to the excursion overshoot where Xmax is exceeded', () => {
    const loud = sweep(DRV, 'vented', { ...VENTED, eg: 40 });
    let clamped = 0;
    for (let i = 0; i < loud.fs.length; i++) {
      const xPeak = loud.exc[i] / 1000;                 // exc is mm, Xmax is m
      if (xPeak > DRV.Xmax!) {
        clamped++;
        assert.equal(loud.xlimited[i], true, `xlimited[${i}] must be true at ${loud.fs[i].toFixed(1)} Hz`);
        const expected = loud.spl[i] + 20 * Math.log10(DRV.Xmax! / xPeak);
        assert.ok(Math.abs(loud.splXlim[i] - expected) < 1e-9,
          `at ${loud.fs[i].toFixed(1)} Hz: splXlim ${loud.splXlim[i]} should be ${expected}`);
        assert.ok(loud.splXlim[i] < loud.spl[i], 'a clamped point must sit below the unclamped SPL');
      } else {
        assert.equal(loud.splXlim[i], loud.spl[i], `splXlim[${i}] must be untouched below Xmax`);
        assert.equal(loud.xlimited[i], false);
      }
    }
    assert.ok(clamped > 0, 'the 40 V drive should exceed Xmax somewhere in the sweep');
  });

  it('never limits a driver with no Xmax — an unknown limit is not a zero limit', () => {
    const noXmax = { ...RAW }; delete noXmax.Xmax;
    const sw = sweep(derive(noXmax), 'vented', { ...VENTED, eg: 40 });
    for (let i = 0; i < sw.fs.length; i++) {
      assert.equal(sw.splXlim[i], sw.spl[i], `splXlim[${i}] must equal spl[${i}] with no Xmax`);
      assert.equal(sw.xlimited[i], false);
      assert.ok(Number.isFinite(sw.splXlim[i]), `splXlim[${i}] must be finite, got ${sw.splXlim[i]}`);
    }
  });
});

describe('passbandRef — one definition of the passband reference level', () => {
  it('ignores the -200 dB "no output" sentinel', () => {
    assert.equal(passbandRef([-200, 80, 90, 85, -200]), 90);
  });
  it('returns 0 for an all-sentinel curve rather than -200', () => {
    assert.equal(passbandRef([-200, -200]), 0);
  });
});
