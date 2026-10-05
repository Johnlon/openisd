/**
 * "Enable WinISD Re without Rg bug" (`winisdVaModel`), VA chart half: WinISD's amplifier apparent load power is P·Re·|Hf|²/|Z + Rg|
 * (f_46bd30 case 0x14, BUG_20260927_winisd-va-uses-re-not-re-plus-rg). Off, OpenISD gives the
 * apparent power the amplifier delivers: P·(Re + Rg)·|Hf|²/|Z_amp|, Rg counted once.
 */
import {describe, expect, it} from 'vitest';
import {createEngine, type FrequencyGrid, OpenISDProject, ProjectBuilder} from '../../domain/index.js';
import {reproduceWinisdBugs} from '../fixtures/domainBuilders.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const W5 = {
  Fs_hz: 45, Qes: 0.57, Qms: 3.56, Qts: 0.49, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4,
  BL_Tm: 7.17, Le_H: 0.00034, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881, Rms_kg_per_s: 2.2881560650261163,
  Xmax_m: 0.00925, Pe_W: 40,
};
const engine = createEngine();
const w5 = (): OpenISDProject => {
  const project = new ProjectBuilder(driverFromSpec(engine, W5), engine).sealed().volume_m3(0.00448).build();
  reproduceWinisdBugs(project);
  project.powerDrive_W.set(1);
  project.Rs_ohm.set(1);
  project.rgAtDriverSide.set(false);
  return project;
};
const at = (f: number): FrequencyGrid => ({fmin: f, fmax: f * 1.0001, N: 1});
const va = (p: OpenISDProject, f: number): number => p.sweep(at(f)).values!.va[0];

describe('winisdVaModel', () => {
  it('defaults off: the amplifier\'s VA, WinISD\'s bug fixed', () => {
    expect(new ProjectBuilder(driverFromSpec(engine, W5), engine).sealed().volume_m3(0.00448).build().winisdVaModel.value).toBe(false);
  });

  it('off: (Re + Rg)/Re times WinISD\'s VA, Rg 1 Ω at the amplifier (WinISD 0.7690233575004378 VA at 1 Hz)', () => {
    const p = w5();
    p.winisdVaModel.set(false);
    expect(Math.abs(va(p, 1) / (0.7690233575004378 * 4.4 / 3.4) - 1)).toBeLessThan(1e-9);
  });

  it('off: Rg is counted once — at the driver side or at the amplifier, one driver sees the same load', () => {
    const amp = w5(); amp.winisdVaModel.set(false);
    const drv = w5(); drv.winisdVaModel.set(false); drv.rgAtDriverSide.set(true);
    expect(va(drv, 65.36) / va(amp, 65.36)).toBeCloseTo(1, 12);
  });


  it('is saved in the project and read back', () => {
    const p = w5();
    p.winisdVaModel.set(false);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), engine);
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdVaModel.value).toBe(false);
  });
});
