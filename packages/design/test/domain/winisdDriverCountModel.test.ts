import {describe, expect, it} from 'vitest';
import {createEngine, type FrequencyGrid, OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const W5 = {
  Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4,
  BL_Tm: 7.17, Le_H: 0.00034, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881, Rms_kg_per_s: 2.2881560650261163,
  Xmax_m: 0.00925, Pe_W: 40,
};

const engine = createEngine();

const w5 = (): OpenISDProject => {
  const project = new ProjectBuilder(driverFromSpec(engine, W5), engine).sealed().volume_m3(0.00448).build();
  project.powerDrive_W.set(1);
  return project;
};

const at = (f: number): FrequencyGrid => ({fmin: f, fmax: f * 1.0001, N: 1});

describe('winisdDriverCountModel', () => {
  it('defaults off: WinISD\'s per-driver impedance is a WinISD bug, fixed by default (John, 2026-10-05)', () => {
    expect(w5().winisdDriverCountModel.value).toBe(false);
  });

  it('off: two drivers in series show four times the parallel impedance at high frequency', () => {
    const p = w5();
    p.winisdDriverCountModel.set(false);
    p.nDrivers.set(2);
    p.wiring.set('parallel');
    const parallel = p.sweep(at(20000)).values!.zmag[0];
    p.wiring.set('series');
    expect(p.sweep(at(20000)).values!.zmag[0] / parallel).toBeCloseTo(4, 2);
  });


  // WinISD probe, W5 sealed, 1 W, 1 → 4 drivers (winisd_research
  // bugs/BUG_20261005_winisd_multi_driver_impedance_is_one_drivers.md): the impedance chart shows
  // one driver's (the bug); the VA chart shows the whole array's, the same 0.968 VA at 1 and 4.
  const four = (bug: boolean, wiring: 'series' | 'parallel' = 'parallel'): OpenISDProject => {
    const p = w5();
    p.nDrivers.set(4);
    p.wiring.set(wiring);
    p.winisdDriverCountModel.set(bug);
    return p;
  };

  it('VA is the whole array\'s in both states, not one driver\'s (WinISD probe: 0.968 VA at 1 and 4 drivers)', () => {
    const one = w5().sweep(at(20000)).values!.va[0];
    for (const bug of [true, false]) {
      expect(four(bug).sweep(at(20000)).values!.va[0] / one, `bug ${bug}`).toBeCloseTo(1, 3);
    }
  });

  it('ticked: the impedance chart is one driver\'s (WinISD); unticked: the array per the wiring', () => {
    const one = w5().sweep(at(20000)).values!.zmag[0];
    expect(four(true).sweep(at(20000)).values!.zmag[0] / one).toBeCloseTo(1, 3);
    expect(four(false, 'parallel').sweep(at(20000)).values!.zmag[0] / one).toBeCloseTo(1 / 4, 3);
    expect(four(false, 'series').sweep(at(20000)).values!.zmag[0] / one).toBeCloseTo(4, 3);
  });

  it('SPL is WinISD\'s in both states: the array of four, +12.04 dB over one driver in a quarter of the box at P/4', () => {
    const a = four(true).sweep(at(1000)).values!.spl[0];
    const b = four(false).sweep(at(1000)).values!.spl[0];
    expect(b).toBeCloseTo(a, 9);
  });

  it('is saved in the project and read back', () => {
    const p = w5();
    p.winisdDriverCountModel.set(true);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdDriverCountModel.value).toBe(true);
  });
});
