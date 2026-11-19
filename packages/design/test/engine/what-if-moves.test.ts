/**
 * T744, QO535 (John, 11 Nov 2026): the What-if panel's rule. A typed result keeps the other results and moves the parts;
 * a typed part keeps the other parts and moves the results that depend on it. Rows 0-8 are the board item's table, E150HE-44.
 */
import {describe, expect, it} from 'vitest';
import {whatIfMoves} from '../../engine/driver/whatIfMoves.js';
import type {WhatIfFigures} from '../../engine/driver/whatIfMoves.js';
import {FixedAir} from '../../engine/air.js';

/** The app's air at 20 °C, 30 % RH, 101325 Pa. */
const AIR = new FixedAir({rho: 1.2041, c: 343.21});

/** Row 0, the datasheet: Fs 40, Vas 7.65 L, Qts 0.40, Qes 0.46, Qms 2.94; Mms 26.6 g, Cms 0.60 mm/N. */
const ROW0: WhatIfFigures = {
  Fs_hz: 40, Vas_m3: 0.00765, Qts: 0.40, Qes: 0.46, Qms: 2.94, SPL_dB: 88,
  Mms_kg: 0.0266, Cms_m_per_N: 0.0006, Rms_kg_per_s: 2.27, BL_Tm: 5.0, Sd_m2: 0.0095, Re_ohm: 6.6,
};

/** The rows after the edit: the moved figures over row 0. */
const after = (moves: Partial<WhatIfFigures>, typed: Partial<WhatIfFigures>): WhatIfFigures => ({...ROW0, ...moves, ...typed});

describe('QO535 What-if rule, E150HE-44', () => {
  it('row 1: Fs 35 Hz: Vas, Qts, Qes, Qms stay; Mms 34.7 g, Bl and Rms move', () => {
    const v = after(whatIfMoves('Fs_hz', 35, ROW0, AIR), {Fs_hz: 35});
    expect([v.Vas_m3, v.Qts, v.Qes, v.Qms, v.Cms_m_per_N]).toEqual([0.00765, 0.40, 0.46, 2.94, 0.0006]);
    expect(v.Mms_kg).toBeCloseTo(0.0347, 4);
    expect(v.BL_Tm).not.toBe(ROW0.BL_Tm);
    expect(v.Rms_kg_per_s).not.toBe(ROW0.Rms_kg_per_s);
  });

  it('row 2: Vas 10 L: Fs and the Qs stay; Cms 0.78, Mms 20.3 g, Bl and Rms move', () => {
    const v = after(whatIfMoves('Vas_m3', 0.010, ROW0, AIR), {Vas_m3: 0.010});
    expect([v.Fs_hz, v.Qts, v.Qes, v.Qms]).toEqual([40, 0.40, 0.46, 2.94]);
    expect(v.Cms_m_per_N).toBeCloseTo(0.00078, 5);
    expect(v.Mms_kg).toBeCloseTo(0.0203, 4);
    expect(v.BL_Tm).not.toBe(ROW0.BL_Tm);
    expect(v.Rms_kg_per_s).not.toBe(ROW0.Rms_kg_per_s);
  });

  it('row 3: Qts 0.45: Fs, Vas, Qms stay; Qes 0.53, Bl down 7%', () => {
    const v = after(whatIfMoves('Qts', 0.45, ROW0, AIR), {Qts: 0.45});
    expect([v.Fs_hz, v.Vas_m3, v.Qms, v.Mms_kg, v.Cms_m_per_N]).toEqual([40, 0.00765, 2.94, 0.0266, 0.0006]);
    expect(v.Qes).toBeCloseTo(0.53, 2);
    expect(v.BL_Tm! / ROW0.BL_Tm!).toBeCloseTo(0.93, 2);
  });

  it('row 4: Sensitivity +3 dB: Fs, Vas, Qms stay; Qts 0.21, Qes 0.23, Bl up 41%', () => {
    const v = after(whatIfMoves('SPL_dB', 91.0103, ROW0, AIR), {SPL_dB: 91.0103});
    expect([v.Fs_hz, v.Vas_m3, v.Qms]).toEqual([40, 0.00765, 2.94]);
    expect(v.Qes).toBeCloseTo(0.23, 2);
    expect(v.Qts).toBeCloseTo(0.21, 2);
    expect(v.BL_Tm! / ROW0.BL_Tm!).toBeCloseTo(1.41, 2);
  });

  it('row 5: Mms 34.6 g: Fs 35, Qts 0.45, Qes 0.52, Qms 3.35; Vas and the other parts stay', () => {
    const v = after(whatIfMoves('Mms_kg', 0.0346, ROW0, AIR), {Mms_kg: 0.0346});
    expect(v.Fs_hz).toBeCloseTo(35, 0);
    expect(v.Qts).toBeCloseTo(0.45, 2);
    expect(v.Qes).toBeCloseTo(0.52, 2);
    expect(v.Qms).toBeCloseTo(3.35, 2);
    expect([v.Vas_m3, v.Cms_m_per_N, v.Rms_kg_per_s, v.BL_Tm, v.Sd_m2, v.Re_ohm]).toEqual([0.00765, 0.0006, 2.27, 5.0, 0.0095, 6.6]);
  });

  it('row 6: Cms 0.80: Fs 35, Vas 10.2, Qts 0.35, Qes 0.40, Qms 2.55; the other parts stay', () => {
    const v = after(whatIfMoves('Cms_m_per_N', 0.0008, ROW0, AIR), {Cms_m_per_N: 0.0008});
    expect(v.Fs_hz).toBeCloseTo(35, 0);
    expect(v.Vas_m3).toBeCloseTo(0.0102, 4);
    // The board rounds Qts to 0.35; Qes 0.398 and Qms 2.546 give 0.345.
    expect(v.Qts).toBeCloseTo(0.345, 2);
    expect(v.Qes).toBeCloseTo(0.40, 2);
    expect(v.Qms).toBeCloseTo(2.55, 2);
    expect([v.Mms_kg, v.Rms_kg_per_s, v.BL_Tm, v.Sd_m2, v.Re_ohm]).toEqual([0.0266, 2.27, 5.0, 0.0095, 6.6]);
  });

  it('row 7: Rms doubled: Qts 0.35, Qms 1.47; Fs, Vas, Qes and the other parts stay', () => {
    const v = after(whatIfMoves('Rms_kg_per_s', 4.54, ROW0, AIR), {Rms_kg_per_s: 4.54});
    expect(v.Qms).toBeCloseTo(1.47, 2);
    expect(v.Qts).toBeCloseTo(0.35, 2);
    expect([v.Fs_hz, v.Vas_m3, v.Qes, v.Mms_kg, v.Cms_m_per_N, v.BL_Tm]).toEqual([40, 0.00765, 0.46, 0.0266, 0.0006, 5.0]);
  });

  it('row 8: Bl +10%: Qts 0.34, Qes 0.38; Fs, Vas, Qms and the other parts stay', () => {
    const v = after(whatIfMoves('BL_Tm', 5.5, ROW0, AIR), {BL_Tm: 5.5});
    expect(v.Qes).toBeCloseTo(0.38, 2);
    expect(v.Qts).toBeCloseTo(0.34, 2);
    expect([v.Fs_hz, v.Vas_m3, v.Qms, v.Mms_kg, v.Cms_m_per_N, v.Rms_kg_per_s]).toEqual([40, 0.00765, 2.94, 0.0266, 0.0006, 2.27]);
  });

  it('a Qts at or above Qms has no Qes: nothing moves', () => {
    expect(whatIfMoves('Qts', 3, ROW0, AIR)).toEqual({});
  });

  it('an empty box moves nothing and is not filled', () => {
    expect(whatIfMoves('Fs_hz', 35, {...ROW0, Fs_hz: null}, AIR)).toEqual({});
    expect('SPL_dB' in whatIfMoves('BL_Tm', 5.5, {...ROW0, SPL_dB: null}, AIR)).toBe(false);
  });

  it('SPL moves with the reference efficiency Fs³·Vas/Qes, through the engine\'s one SPL-from-efficiency relation, in any air', () => {
    const hot = new FixedAir({rho: 1.12, c: 352});
    // Each typed figure and the factor it moves η₀ = (4π²/c³)·Fs³·Vas/Qes by.
    const cases: readonly (readonly [keyof WhatIfFigures, number, number])[] = [
      ['Fs_hz', 35, (35 / 40) ** 3], ['Vas_m3', 0.010, 0.010 / 0.00765], ['Qes', 0.40, 0.46 / 0.40],
      ['Mms_kg', 0.0346, (0.0266 / 0.0346) ** 2], ['BL_Tm', 5.5, (5.5 / 5) ** 2], ['Sd_m2', 0.0114, (0.0114 / 0.0095) ** 2],
      ['Re_ohm', 8, 6.6 / 8],
    ];
    for (const [figure, value, etaFactor] of cases) {
      const want = 88 + 10 * Math.log10(etaFactor);
      expect(whatIfMoves(figure, value, ROW0, AIR).SPL_dB).toBeCloseTo(want, 9);
      expect(whatIfMoves(figure, value, ROW0, hot).SPL_dB).toBeCloseTo(want, 9);
    }
    expect(whatIfMoves('Cms_m_per_N', 0.0008, ROW0, AIR).SPL_dB).toBeUndefined();
    expect(whatIfMoves('SPL_dB', 91.0103, ROW0, hot).Qes).toBeCloseTo(0.46 / 10 ** (3.0103 / 10), 9);
  });
});
