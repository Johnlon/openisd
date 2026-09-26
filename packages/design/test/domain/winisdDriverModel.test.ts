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
    const winisd = projectOn(engine, {...SHARED});

    const mine = entered.sweep(P).values!;
    const theirs = winisd.sweep(P).values!;
    const differs = mine.spl.some((db, i) => Math.abs(db - theirs.spl[i]) > 0.01);
    expect(differs).toBe(true);
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
