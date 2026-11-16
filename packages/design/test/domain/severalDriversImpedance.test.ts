import {describe, expect, it} from 'vitest';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {createEngine} from '../../engine/Engine.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

/**
 * Several drivers are WinISD's (QO941, John 15 Nov 2026: "for now replicate winisd"). Read in winisd.exe 0.7.0.950
 * (winisd_research FINDING_20261115_voice-coil-connection-and-driver-count-in-the-code): the number of drivers
 * never wires anything; the impedance chart is one driver's (routine 0x45e740 never multiplies or divides Re by
 * Nd); SPL, maximum power and VA are the array's. Observed in WinISD on 5 Oct 2026 (W5 sealed, 1 W, 1 to 4
 * drivers): impedance peak 18.609 ohm at 1 and 4 drivers, VA 0.968 VA at both.
 * This replaces `winisdDriverCountModel.test.ts`, which pinned the array's impedance and the "Per-driver
 * impedance" switch. That 5 Oct 2026 change was an agent's classification John did not intend (QO941.c33/c34);
 * it is withdrawn on his word of 15 Nov 2026, and the switch is gone.
 */
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

const four = (): OpenISDProject => {
  const p = w5();
  p.nDrivers.set(4);
  return p;
};

describe('several drivers', () => {
  it('the impedance chart is one driver\'s at any driver count (WinISD: 18.609 ohm peak at 1 and at 4)', () => {
    const one = w5().sweep(at(20000)).values!.zmag[0];
    expect(four().sweep(at(20000)).values!.zmag[0] / one).toBeCloseTo(1, 6);
  });

  it('VA is the whole array\'s (WinISD probe: 0.968 VA at 1 and 4 drivers)', () => {
    const one = w5().sweep(at(20000)).values!.va[0];
    expect(four().sweep(at(20000)).values!.va[0] / one).toBeCloseTo(1, 3);
  });

  it('the retired Per-driver impedance switch in an old file is read and ignored', () => {
    const p = four();
    const text = p.toOwprText().replace('"advanced": {', '"advanced": {\n    "winisdDriverCountModel": false,');
    const back = OpenISDProject.fromOwprText(text, engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    const one = w5().sweep(at(20000)).values!.zmag[0];
    expect(back.sweep(at(20000)).values!.zmag[0] / one).toBeCloseTo(1, 6);
  });

  const saved = (wiring: 'series' | 'parallel'): OpenISDProject => {
    const text = four().toOwprText().replaceAll('"driverEmbedding": {', `"driverEmbedding": {\n    "VCCon": "${wiring}",`);
    const back = OpenISDProject.fromOwprText(text, engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    return back;
  };

  it('the project\'s saved wiring is kept exactly as saved, and changes nothing (QO946.c23: "the project VcCon is preserved as is")', () => {
    for (const wiring of ['series', 'parallel'] as const) {
      const back = saved(wiring);
      expect(back.toOwprText()).toContain(`"VCCon": "${wiring}"`);
      const one = w5().sweep(at(20000)).values!.zmag[0];
      expect(back.sweep(at(20000)).values!.zmag[0] / one).toBeCloseTo(1, 6);
    }
  });

  it('a new project writes no wiring of its own (absent until the user sets one)', () => {
    expect(four().toOwprText()).not.toContain('"VCCon"');
  });
});
