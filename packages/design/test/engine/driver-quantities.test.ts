import {describe, expect, it} from 'vitest';
import {isobarikPair, perCoilBL_Tm, perCoilRe_ohm, terminalBL_Tm, terminalRe_ohm} from '../../engine/solvers/driverQuantities.js';

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

describe('per-coil figures are the inverse of the terminal ones', () => {
  it.each([
    [undefined, undefined, 6, 7],
    [1, 'series' as const, 6, 7],
    [2, 'series' as const, 12, 14],
    [2, 'parallel' as const, 3, 7],
    [0, 'series' as const, 6, 7],
  ])('numVC %s, %s: terminal Re %s and BL %s round trip', (numVC, wiring, terminalRe, terminalBL) => {
    expect(terminalRe_ohm(perCoilRe_ohm(terminalRe, numVC, wiring), numVC, wiring)).toBeCloseTo(terminalRe, 12);
    expect(terminalBL_Tm(perCoilBL_Tm(terminalBL, numVC, wiring), numVC, wiring)).toBeCloseTo(terminalBL, 12);
  });

  it('two series coils: each coil has half the terminal resistance and half the terminal BL', () => {
    expect(perCoilRe_ohm(12, 2, 'series')).toBe(6);
    expect(perCoilBL_Tm(14, 2, 'series')).toBe(7);
  });

  it('two parallel coils: each coil has twice the terminal resistance and the terminal BL', () => {
    expect(perCoilRe_ohm(3, 2, 'parallel')).toBe(6);
    expect(perCoilBL_Tm(7, 2, 'parallel')).toBe(7);
  });
});
