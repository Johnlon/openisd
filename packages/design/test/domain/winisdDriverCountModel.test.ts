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
  it('defaults on', () => {
    expect(w5().winisdDriverCountModel.value).toBe(true);
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


  it('is saved in the project and read back', () => {
    const p = w5();
    p.winisdDriverCountModel.set(false);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdDriverCountModel.value).toBe(false);
  });
});
