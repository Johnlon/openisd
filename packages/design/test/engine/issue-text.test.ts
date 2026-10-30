import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';

const engine = createEngine();

describe('plainNames', () => {
  it.each([
    ['Mms_kg', 'moving mass (Mms)'],
    ['Cms_m_per_N', 'compliance (Cms)'],
    ['Rms_kg_per_s', 'mechanical resistance (Rms)'],
    ['Rme_kg_per_s', 'electrical damping (Rme)'],
    ['Fs_hz', 'resonance (Fs)'],
    ['Vas_m3', 'equivalent volume (Vas)'],
    ['Sd_m2', 'cone area (Sd)'],
    ['Re_ohm', 'coil resistance (Re)'],
    ['Re_terminal_ohm', 'coil resistance at the terminals (Re)'],
    ['BL_terminal_Tm', 'force factor at the terminals (BL)'],
    ['BL_Tm', 'force factor (BL)'],
    ['Xmax_m', 'peak excursion (Xmax)'],
    ['Vb_m3', 'box volume (Vb)'],
    ['volume_m3', 'box volume'],
    ['length_m', 'vent length'],
    ['area_m2', 'vent area'],
    ['tuning_goal_hz', 'tuning'],
    ['addedMass_kg', 'added mass'],
    ['prMmd_kg', 'radiator moving mass'],
    ['prSd_m2', 'radiator cone area'],
    ['prCms_m_per_N', 'radiator compliance'],
    ['voltage_V', 'drive voltage'],
    ['power_W', 'drive power'],
    ['Mpow_N_per_sqrtW', 'Mpow'],
  ])('%s reads %s', (key, plain) => {
    expect(engine.issues.plainNames(`${key} is wrong`)).toBe(`${plain} is wrong`);
  });
});
