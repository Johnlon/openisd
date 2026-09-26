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
import {Engine, type FrequencyGrid, OpenISDProject} from '../../domain/index.js';
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
    const project = OpenISDProject.builder(driverFromSpec(engine, spec), engine)
      .sealed().volume_m3(0.021).build();
    project.powerDrive_W.set(1);
    return project;
  };

  it('set: the inconsistent driver has the consistent one\'s impedance and SPL shape; its entered BL sets only the SPL level', () => {
    const engine = new Engine();
    const entered = projectOn(engine, {...SHARED, ...CONTRADICTORY});
    entered.winisdDriverModel.set(true);
    const winisd = projectOn(engine, {...SHARED});

    const mine = entered.sweep(P).values;
    const theirs = winisd.sweep(P).values;
    expect(mine).not.toBeNull();
    expect(theirs).not.toBeNull();
    const offset = mine!.spl[0] - theirs!.spl[0];
    mine!.spl.forEach((db, i) => expect(db - theirs!.spl[i]).toBeCloseTo(offset, 6));
    mine!.zmag.forEach((z, i) => expect(z).toBeCloseTo(theirs!.zmag[i], 6));
  });

  it('set: the entered BL sets the SPL level — WinISD, BL 7.17 → 5.0, moves every point by −3.1310 dB (BUG_20260926_winisd-spl-level-uses-entered-bl)', () => {
    // WinISD 0.7.0.950 by debugger, W5-1138SMF sealed, only the entered BL changed
    // (winisd_research runs/sweep-w5-sealed-bl5-spl vs sweep-w5-sealed-baseline-charts).
    const engine = new Engine();
    const a = projectOn(engine, {...SHARED, BL_Tm: 7.17});
    const b = projectOn(engine, {...SHARED, BL_Tm: 5.0});
    const sa = a.sweep(P).values!, sb = b.sweep(P).values!;
    sa.spl.forEach((db, i) => expect(sb.spl[i] - db).toBeCloseTo(20 * Math.log10(5 / 7.17), 9));
    sa.zmag.forEach((z, i) => expect(sb.zmag[i]).toBeCloseTo(z, 9));
  });

  it('clear: the entered Mms, BL and Rms are what the sweep uses', () => {
    const engine = new Engine();
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
    const engine = new Engine();
    const air = engine.solveEnvironment({useWinisdAirModel: true}).values;
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
    const engine = new Engine();
    expect(projectOn(engine, {...SHARED}).winisdDriverModel.value).toBe(true);
  });

  it('a self-consistent driver is unmoved by the flag — every substitution is an identity there', () => {
    const engine = new Engine();
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
      const project = OpenISDProject.builder(driverFromSpec(engine, W5), engine)
        .sealed().volume_m3(0.00448).build();
      project.powerDrive_W.set(1);
      project.Rs_ohm.set(0.1);
      project.rgAtDriverSide.set(false);
      return project;
    };
    const at = (f: number): FrequencyGrid => ({fmin: f, fmax: f * 1.0001, N: 1});

    it('SPL at 998.56 Hz is WinISD\'s 80.5315 dB, within the 0.02 dB not yet explained', () => {
      const spl = w5(new Engine()).sweep(at(998.5627339581864)).values!.spl[0];
      expect(Math.abs(spl - 80.53153351704296)).toBeLessThan(0.02);
    });

    it('with voice coil inductance on, the flag selects WinISD\'s inductance model: on − off is −22.266 dB at 20 kHz', () => {
      const engine = new Engine();
      const off = w5(engine).sweep(at(20000)).values!.spl[0];
      const project = w5(engine);
      project.circuitModel.set('gyrator');
      const on = project.sweep(at(20000)).values!.spl[0];
      expect(Math.abs((on - off) - -22.266)).toBeLessThan(0.01);
    });

    it('with voice coil inductance on and the flag clear, the inductance is the textbook one', () => {
      const engine = new Engine();
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
  const engine = new Engine();
  const project = (): OpenISDProject => OpenISDProject.builder(driverFromSpec(engine, {
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
