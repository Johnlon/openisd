import {describe, expect, it} from 'vitest';
import {isobarikPair, withAddedMass} from '../../engine/solvers/driverQuantities.js';

describe('isobarikPair', () => {
  it('doubles the mass and damping, halves the compliance and Vas, and scales terminal BL by root 2', () => {
    const pair = isobarikPair({
      Mms_kg: 0.02, Cms_m_per_N: 0.001, Rms_kg_per_s: 1.5, Vas_m3: 0.04, BL_terminal_Tm: 7, BL_Tm: 7, Fs_hz: 40,
    });
    expect(pair).toEqual({
      Mms_kg: 0.04, Cms_m_per_N: 0.0005, Rms_kg_per_s: 3, Vas_m3: 0.02, BL_terminal_Tm: 7 * Math.SQRT2, BL_Tm: 7, Fs_hz: 40,
    });
  });

  it('leaves a figure the driver does not state absent', () => {
    expect(isobarikPair({Fs_hz: 40})).toEqual({Fs_hz: 40});
  });
});

describe('withAddedMass', () => {
  // A 2-coil driver published in series: Re 4.7 Ω, BL 12.3 Tm (Dayton MX6-22), Mms 63.8 g,
  // Cms 0.44 mm/N, Rms 4.02 kg/s. 10 g added: Mms 73.8 g, ωs = 1/√(0.0738·0.00044) = 175.49,
  // Qes = ωs·Mms·Re/BL² = 175.49·0.0738·4.7/151.29 = 0.4023, on the published Re and BL whatever
  // the wiring.
  it('runs Qes on the published Re and BL, whatever the coils and wiring', () => {
    const drv = {Mms_kg: 0.0638, Cms_m_per_N: 0.00044, Rms_kg_per_s: 4.02, Re_ohm: 4.7, BL_Tm: 12.3, numVC: 2, wiring: 'parallel' as const};
    const ws = 1 / Math.sqrt(0.0738 * 0.00044);
    expect(withAddedMass(drv, 0.01).Qes).toBeCloseTo(ws * 0.0738 * 4.7 / (12.3 * 12.3), 12);
    expect(withAddedMass(drv, 0.01).Qes).toBeCloseTo(0.4023, 4);
    expect(withAddedMass({...drv, wiring: 'series'}, 0.01).Qes).toBe(withAddedMass(drv, 0.01).Qes);
  });
});
