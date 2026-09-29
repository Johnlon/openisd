/**
 * "Use WinISD driver calculations" (`winisdDriverModel`) on a driver whose entered `Mms`, `BL`
 * and `Rms` disagree with its own `Fs`, `Cms`, `Qes` and `Qms`.
 *
 * WinISD 0.7.0.950, probed under wine 2026-09-26 (`winisd_research/PROBE_FINDINGS.md`), keeps all
 * three entered values untouched and simulates from `Fs`, `Vas`, `Qes`, `Qms`, `Sd` and `Re`
 * alone — its equivalent circuit names neither `BL` nor `Rms` except in `CLe`. So with the flag
 * set, an inconsistent driver must sweep as the consistent driver its `Fs`/`Cms`/`Qes`/`Qms`/`Re`
 * imply, and with it clear it must sweep as its entered values say.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine, type FrequencyGrid, OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

describe('winisdDriverModel — the whole WinISD parameter set, not Mms alone', () => {
  // The probe driver. Fs/Cms imply Mms = 0.04346 kg, not the 0.060 entered; Fs/Qms/Mms imply
  // Rms = 2.399 kg/s, not 1.5; Re/Fs/Qes/Cms imply BL = 6.62 Tm, not 8.0.
  const SHARED = {
    Fs_hz: 29, Cms_m_per_N: 0.000693, Vas_m3: 0.142, Sd_m2: 0.038, Re_ohm: 6.5,
    Qes: 0.44, Qms: 3.3, Qts: 1 / (1 / 0.44 + 1 / 3.3), Xmax_m: 0.008, Pe_W: 100,
  } as const;
  const CONTRADICTORY = {Mms_kg: 0.060, BL_Tm: 8.0, Rms_kg_per_s: 1.5} as const;

  const P: FrequencyGrid = {fmin: 10, fmax: 1000, N: 120};

  /** A sealed 21 L project at 1 W on the given spec. */
  const projectOn = (engine: Engine, spec: Record<string, number>): OpenISDProject => {
    const project = new ProjectBuilder(driverFromSpec(engine, spec), engine)
      .sealed().volume_m3(0.021).build();
    project.powerDrive_W.set(1);
    return project;
  };

  /** Z − Re as a complex number, from the sweep's magnitude and phase (deg). */
  const motional = (zmag: number, zphDeg: number, Re: number): {re: number; im: number} => {
    const ph = zphDeg * Math.PI / 180;
    return {re: zmag * Math.cos(ph) - Re, im: zmag * Math.sin(ph)};
  };

  it('set: the inconsistent driver has the consistent one\'s impedance and SPL shape; its entered BL sets the SPL level and the motional impedance\'s scale', () => {
    const engine = createEngine();
    const entered = projectOn(engine, {...SHARED, ...CONTRADICTORY});
    entered.winisdDriverModel.set(true);
    const winisd = projectOn(engine, {...SHARED});

    const mine = entered.sweep(P).values;
    const theirs = winisd.sweep(P).values;
    expect(mine).not.toBeNull();
    expect(theirs).not.toBeNull();
    const offset = mine!.spl[0] - theirs!.spl[0];
    mine!.spl.forEach((db, i) => expect(db - theirs!.spl[i]).toBeCloseTo(offset, 6));
    // BUG_20260926_winisd-impedance-uses-entered-bl: Z − Re scales by one real factor.
    const ratio = (i: number): {re: number; im: number} => {
      const a = motional(mine!.zmag[i], mine!.zph[i], SHARED.Re_ohm);
      const b = motional(theirs!.zmag[i], theirs!.zph[i], SHARED.Re_ohm);
      const d = b.re * b.re + b.im * b.im;
      return {re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d};
    };
    const k = ratio(0).re;
    mine!.zmag.forEach((_, i) => {
      expect(ratio(i).re).toBeCloseTo(k, 6);
      expect(ratio(i).im).toBeCloseTo(0, 6);
    });
  });

  it('set: the entered BL sets the SPL level and the motional impedance — WinISD, BL 7.17 → 5.0, moves every SPL point by −3.1310 dB (BUG_20260926_winisd-spl-level-uses-entered-bl)', () => {
    // WinISD 0.7.0.950 by debugger, W5-1138SMF sealed, only the entered BL changed
    // (winisd_research runs/sweep-w5-sealed-bl5-spl vs sweep-w5-sealed-baseline-charts).
    const engine = createEngine();
    const a = projectOn(engine, {...SHARED, BL_Tm: 7.17});
    const b = projectOn(engine, {...SHARED, BL_Tm: 5.0});
    const sa = a.sweep(P).values!, sb = b.sweep(P).values!;
    sa.spl.forEach((db, i) => expect(sb.spl[i] - db).toBeCloseTo(20 * Math.log10(5 / 7.17), 9));
    // WinISD's impedance is Re + (BL²/Sd²)/Za with the entered BL (fresh capture,
    // BUG_20260926_winisd-impedance-uses-entered-bl), so Z − Re scales by (5/7.17)².
    sa.zmag.forEach((z, i) => {
      const ma = motional(z, sa.zph[i], SHARED.Re_ohm), mb = motional(sb.zmag[i], sb.zph[i], SHARED.Re_ohm);
      expect(mb.re / ma.re).toBeCloseTo((5 / 7.17) ** 2, 9);
    });
  });

  it('clear: the entered Mms, BL and Rms are what the sweep uses', () => {
    const engine = createEngine();
    const entered = projectOn(engine, {...SHARED, ...CONTRADICTORY});
    entered.winisdDriverModel.set(false);
    const winisd = projectOn(engine, {...SHARED});
    winisd.winisdDriverModel.set(false);

    const mine = entered.sweep(P).values!;
    const theirs = winisd.sweep(P).values!;
    const differs = mine.spl.some((db, i) => Math.abs(db - theirs.spl[i]) > 0.01);
    expect(differs).toBe(true);
  });

  it('set: Vas, not the entered Cms, is what the compliance comes from', () => {
    // WinISD takes Cms from Vas (debugger capture, winisd_research 4d818e2). This driver's Vas is
    // 20% larger than its entered Cms implies, so the two disagree and only one can drive the
    // sweep. Driver B states the Cms that Vas implies at the project's own air, reached here by
    // asking the engine for it rather than by writing a number this test would have to maintain.
    const engine = createEngine();
    const air = engine.environment.solve({useWinisdAirModel: true}).values;
    const Vas_m3 = SHARED.Vas_m3 * 1.2;
    const cmsFromVas = Vas_m3 / (air.rho * air.c * air.c * SHARED.Sd_m2 * SHARED.Sd_m2);

    const byVas = projectOn(engine, {...SHARED, Vas_m3});
    const byCms = projectOn(engine, {...SHARED, Vas_m3, Cms_m_per_N: cmsFromVas});

    const mine = byVas.sweep(P).values!;
    const theirs = byCms.sweep(P).values!;
    mine.spl.forEach((db, i) => expect(db).toBeCloseTo(theirs.spl[i], 6));

    // ...and the two drivers really are different drivers: cleared, they sweep apart.
    byVas.winisdDriverModel.set(false);
    byCms.winisdDriverModel.set(false);
    const a = byVas.sweep(P).values!, b = byCms.sweep(P).values!;
    expect(a.spl.some((db, i) => Math.abs(db - b.spl[i]) > 0.01)).toBe(true);
  });

  it('defaults on — README: "by default, OpenISD behaves 100% like WinISD"', () => {
    const engine = createEngine();
    expect(projectOn(engine, {...SHARED}).winisdDriverModel.value).toBe(true);
  });

  it('a self-consistent driver is unmoved by the flag — every substitution is an identity there', () => {
    const engine = createEngine();
    const off = projectOn(engine, {...SHARED});
    const on = projectOn(engine, {...SHARED});
    on.winisdDriverModel.set(true);

    const a = off.sweep(P).values!;
    const b = on.sweep(P).values!;
    b.spl.forEach((db, i) => expect(db).toBeCloseTo(a.spl[i], 9));
  });

  describe('the W5-1138SMF against WinISD\'s debugger values (winisd_research runs/sweep-w5-sealed-*)', () => {
    const W5 = {
      Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4,
      BL_Tm: 7.17, Le_H: 0.00034, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881, Rms_kg_per_s: 2.2881560650261163,
      Xmax_m: 0.00925, Pe_W: 40,
    };
    const w5 = (engine: Engine): OpenISDProject => {
      const project = new ProjectBuilder(driverFromSpec(engine, W5), engine)
        .sealed().volume_m3(0.00448).build();
      project.powerDrive_W.set(1);
      project.Rs_ohm.set(0.1);
      project.rgAtDriverSide.set(false);
      return project;
    };
    const at = (f: number): FrequencyGrid => ({fmin: f, fmax: f * 1.0001, N: 1});

    // Fresh capture winisd_research/runs/sweep-w5-sealed-fresh-20260926 (BUG_20260926_winisd-box-absorption-is-series).
    it('SPL at 998.56 Hz is WinISD\'s 80.531534 dB', () => {
      const spl = w5(createEngine()).sweep(at(998.5627339581864)).values!.spl[0];
      expect(Math.abs(spl - 80.53153351704296)).toBeLessThan(1e-4);
    });

    it('SPL at 86.50 Hz, near the box resonance, is WinISD\'s 79.298205 dB', () => {
      const spl = w5(createEngine()).sweep(at(86.49890926764193)).values!.spl[0];
      expect(Math.abs(spl - 79.29820533868933)).toBeLessThan(1e-4);
    });

    it('max SPL at 3.909 Hz is WinISD\'s 45.221447 dB', () => {
      const project = w5(createEngine());
      const maxspl = project.maxCurves(at(3.9087353201234074)).values!.maxspl[0];
      expect(Math.abs(maxspl - 45.2214471072186)).toBeLessThan(1e-4);
    });

    it('max power at 1 Hz is WinISD\'s 21.254886 W: power is into Re + Rg, as the 1 W drive is', () => {
      const maxpwr = w5(createEngine()).maxCurves(at(1)).values!.maxpwr[0];
      expect(Math.abs(maxpwr / 21.25488626455778 - 1)).toBeLessThan(1e-6);
    });

    it('|Z| at 65.36 Hz, the impedance peak, is WinISD\'s 18.620133 Ω: the motional term uses the entered BL', () => {
      const zmag = w5(createEngine()).sweep(at(65.35861309217313)).values!.zmag[0];
      expect(Math.abs(zmag - 18.620133017798484)).toBeLessThan(1e-5);
    });

    it('transfer function at 998.56 Hz is WinISD\'s −0.015566 dB: 0 dB is the circuit\'s own HF asymptote', () => {
      const tf = w5(createEngine()).sweep(at(998.5627339581864)).values!.tfMag[0];
      expect(Math.abs(tf - -0.015566171957418983)).toBeLessThan(1e-4);
    });

    it('group delay at 1 Hz is WinISD\'s 52.29644 ms: the phase slope at the point, not across grid neighbours', () => {
      // WinISD differentiates at f ± ((f + 1e-10) − f) (chart 12 in f_4618f0); its values carry
      // ±1.77e-4 ms of phase rounding, so 1e-3 ms is the closest a double-precision derivative gets.
      const gd = w5(createEngine()).sweep({fmin: 1, fmax: 20000, N: 2085}).values!.gd[0];
      expect(Math.abs(gd - 52.29644272041911)).toBeLessThan(1e-3);
    });

    // winisd_research runs/sweep-w5-sealed-va-rg1: WinISD's plotted VA by debugger, Rg 1 Ω.
    // WinISD: VA = P·Re·|Hf|²/|Z + Rg| (f_46bd30 case 0x14), Re where Re + Rg belongs.
    it.each([
      [1.0, 0.7690233575004378],
      [65.35861309217313, 0.17330824006319065],
      [20000, 0.7727226000686561],
    ])('amplifier apparent load power at %s Hz, Rg 1 Ω, is WinISD\'s %s VA', (f, va) => {
      const project = w5(createEngine());
      project.Rs_ohm.set(1);
      const got = project.sweep(at(f)).values!.va[0];
      expect(Math.abs(got / va - 1)).toBeLessThan(1e-9);
    });

    // winisd_research runs/sweep-w5-sealed-va-rg1-driverside: Rg at driver side, so Z already holds
    // Rg (4.4 Ω at 20 kHz) and WinISD adds Rg again: VA = P·Re·|Hf|²/|Z + Rg|.
    it.each([
      [1.0, 0.6272023727533522],
      [65.35861309217313, 0.16491643940526038],
      [20000, 0.6296269202788077],
    ])('amplifier apparent load power at %s Hz, Rg 1 Ω at driver side, is WinISD\'s %s VA: Rg counted twice', (f, va) => {
      const project = w5(createEngine());
      project.Rs_ohm.set(1);
      project.rgAtDriverSide.set(true);
      const got = project.sweep(at(f)).values!.va[0];
      expect(Math.abs(got / va - 1)).toBeLessThan(1e-9);
    });

    it('with voice coil inductance on, the flag selects WinISD\'s inductance model: on − off is −22.266 dB at 20 kHz', () => {
      const engine = createEngine();
      const off = w5(engine).sweep(at(20000)).values!.spl[0];
      const project = w5(engine);
      project.circuitModel.set('gyrator');
      const on = project.sweep(at(20000)).values!.spl[0];
      expect(Math.abs((on - off) - -22.266)).toBeLessThan(0.01);
    });

    it('with voice coil inductance on and the flag clear, the inductance is the textbook one', () => {
      const engine = createEngine();
      const winisd = w5(engine);
      winisd.circuitModel.set('gyrator');
      const conventional = w5(engine);
      conventional.circuitModel.set('gyrator');
      conventional.winisdDriverModel.set(false);
      const a = winisd.sweep(at(20000)).values!.spl[0], b = conventional.sweep(at(20000)).values!.spl[0];
      expect(Math.abs(a - b)).toBeGreaterThan(0.1);
    });
  });
});

describe('the saved field is winisdDriverModel (renamed 2026-09-26 from useWinisdDriverModel)', () => {
  const engine = createEngine();
  const project = (): OpenISDProject => new ProjectBuilder(driverFromSpec(engine, {
    Fs_hz: 29, Vas_m3: 0.142, Sd_m2: 0.038, Re_ohm: 6.5, Qes: 0.44, Qms: 3.3,
  }), engine).sealed().volume_m3(0.021).build();

  it('a project saves it as winisdDriverModel', () => {
    const p = project();
    p.winisdDriverModel.set(false);
    const text = p.toOwprText();
    expect(text).toContain('"winisdDriverModel": false');
    expect(text).not.toContain('useWinisdDriverModel');
  });

  it('a project saved under the old name still opens with its value', () => {
    const p = project();
    p.winisdDriverModel.set(false);
    const legacy = p.toOwprText().replaceAll('"winisdDriverModel"', '"useWinisdDriverModel"');
    const back = OpenISDProject.fromOwprText(legacy, engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdDriverModel.value).toBe(false);
  });
});
