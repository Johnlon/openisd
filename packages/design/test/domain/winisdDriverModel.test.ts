/**
 * "Use WinISD driver calculations" (`useWinisdDriverModel`) on a driver whose entered `Mms`, `BL`
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

describe('useWinisdDriverModel — the whole WinISD parameter set, not Mms alone', () => {
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

  it('set: the inconsistent driver sweeps as the consistent one its Fs/Cms/Qes/Qms/Re imply', () => {
    const engine = new Engine();
    const entered = projectOn(engine, {...SHARED, ...CONTRADICTORY});
    entered.useWinisdDriverModel.set(true);
    const winisd = projectOn(engine, {...SHARED});

    const mine = entered.sweep(P).values;
    const theirs = winisd.sweep(P).values;
    expect(mine).not.toBeNull();
    expect(theirs).not.toBeNull();
    mine!.spl.forEach((db, i) => expect(db).toBeCloseTo(theirs!.spl[i], 6));
    mine!.zmag.forEach((z, i) => expect(z).toBeCloseTo(theirs!.zmag[i], 6));
  });

  it('clear: the entered Mms, BL and Rms are what the sweep uses', () => {
    const engine = new Engine();
    const entered = projectOn(engine, {...SHARED, ...CONTRADICTORY});
    entered.useWinisdDriverModel.set(false);
    const winisd = projectOn(engine, {...SHARED});
    winisd.useWinisdDriverModel.set(false);

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
    byVas.useWinisdDriverModel.set(false);
    byCms.useWinisdDriverModel.set(false);
    const a = byVas.sweep(P).values!, b = byCms.sweep(P).values!;
    expect(a.spl.some((db, i) => Math.abs(db - b.spl[i]) > 0.01)).toBe(true);
  });

  it('defaults on — README: "by default, OpenISD behaves 100% like WinISD"', () => {
    const engine = new Engine();
    expect(projectOn(engine, {...SHARED}).useWinisdDriverModel.value).toBe(true);
  });

  it('a self-consistent driver is unmoved by the flag — every substitution is an identity there', () => {
    const engine = new Engine();
    const off = projectOn(engine, {...SHARED});
    const on = projectOn(engine, {...SHARED});
    on.useWinisdDriverModel.set(true);

    const a = off.sweep(P).values!;
    const b = on.sweep(P).values!;
    b.spl.forEach((db, i) => expect(db).toBeCloseTo(a.spl[i], 9));
  });
});
