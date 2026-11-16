/**
 * Rewiring a multi-coil driver (QO900 R1; plan "How the wiring maths works after the fix"): the
 * published Re/BL/Le/Znom are for the measured wiring M; `convertWiring` gives them for the
 * user's wiring U, for N identical coils. Series → parallel: Re ÷ N², BL ÷ N, Le and Znom ÷ N². Parallel → series: the inverse.
 * (WinISD converts Re and BL only: the yellow switch "Coil wiring: Re and BL only", QO942.c62, passes `reBlOnly`.) Fs, Qes, Qms, Qts, Mms, Cms and Vas never change.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {convertWiring} from '../../engine/solvers/driverQuantities.js';
import type {WiredMotor} from '../../engine/solvers/driverQuantities.js';

/** Dayton MX6-22, measured in series (datasheet): Re 4.7 Ω, BL 12.3 Tm, Le 1.5 mH, Znom 4 Ω
 *  (2 Ω per coil, so 4 Ω in series). */
const MX6_22: WiredMotor = {Re_ohm: 4.7, BL_Tm: 12.3, Le_H: 0.0015, Znom_ohm: 4};

function converted(motor: WiredMotor, numVC: number | null, measured: 'series' | 'parallel' | null, target: 'series' | 'parallel'): WiredMotor {
  const result = convertWiring(motor, numVC, measured, target);
  if (!result.converted) throw new Error(result.reason);
  return result.motor;
}

describe('convertWiring', () => {
  it('MX6-22 series → parallel: Re 4.7/4 = 1.175 Ω, BL 12.3/2 = 6.15 Tm, Le 1.5/4 = 0.375 mH, Znom 4/4 = 1 Ω', () => {
    const p = converted(MX6_22, 2, 'series', 'parallel');
    expect(p.Re_ohm).toBeCloseTo(1.175, 12);
    expect(p.BL_Tm).toBeCloseTo(6.15, 12);
    expect(p.Le_H).toBeCloseTo(0.000375, 15);
    expect(p.Znom_ohm).toBeCloseTo(1, 12);
  });

  it('parallel → series is the inverse: 1.175 Ω / 6.15 Tm → 4.7 Ω / 12.3 Tm', () => {
    const s = converted({Re_ohm: 1.175, BL_Tm: 6.15, Le_H: null, Znom_ohm: null}, 2, 'parallel', 'series');
    expect(s.Re_ohm).toBeCloseTo(4.7, 12);
    expect(s.BL_Tm).toBeCloseTo(12.3, 12);
    expect(s.Le_H).toBeNull();
    expect(s.Znom_ohm).toBeNull();
  });

  it('round trip series → parallel → series is exact', () => {
    const back = converted(converted(MX6_22, 2, 'series', 'parallel'), 2, 'parallel', 'series');
    expect(back).toEqual(MX6_22);
  });

  it('the same wiring returns the figures unchanged', () => {
    expect(converted(MX6_22, 2, 'series', 'series')).toEqual(MX6_22);
  });

  it('Qes = 2π·Fs·Mms·Re/BL² is the same after rewiring (0.3736 for the MX6-22)', () => {
    const Fs = 30, Mms = 0.0638;
    const qes = (m: WiredMotor) => 2 * Math.PI * Fs * Mms * m.Re_ohm / (m.BL_Tm * m.BL_Tm);
    const p = converted(MX6_22, 2, 'series', 'parallel');
    expect(qes(MX6_22)).toBeCloseTo(0.3736, 4);
    expect(qes(p)).toBeCloseTo(qes(MX6_22), 12);
    // Rme = BL²/Re and Mpow = √Rme are wiring-invariant the same way.
    expect(p.BL_Tm ** 2 / p.Re_ohm).toBeCloseTo(MX6_22.BL_Tm ** 2 / MX6_22.Re_ohm, 12);
  });

  it('4 identical coils series → parallel: Re ÷ 16, BL ÷ 4', () => {
    const p = converted({Re_ohm: 16, BL_Tm: 20, Le_H: null, Znom_ohm: null}, 4, 'series', 'parallel');
    expect(p.Re_ohm).toBeCloseTo(1, 12);
    expect(p.BL_Tm).toBeCloseTo(5, 12);
  });

  it('refuses when the measured wiring is unknown', () => {
    const r = convertWiring(MX6_22, 2, null, 'parallel');
    expect(r.converted).toBe(false);
    if (!r.converted) expect(r.reason).toBe('The measured wiring is not known, so the figures cannot be converted to another wiring.');
  });

  it.each([[1], [null]])('refuses a driver with %s coil(s)', (numVC) => {
    const r = convertWiring(MX6_22, numVC, 'series', 'parallel');
    expect(r.converted).toBe(false);
    if (!r.converted) expect(r.reason).toBe('A driver with fewer than 2 voice coils has no wiring to change.');
  });

  // WinISD's routine acts for any numVC above 1: Re x/÷ numVC², BL x/÷ numVC (winisd_research FINDING_20261115,
  // read in the code at 0x461240; QO941). OpenISD used to refuse 3 coils; that departure is gone.
  it('3 coils series → parallel: Re ÷ 9, BL ÷ 3, as WinISD does', () => {
    const p = converted({Re_ohm: 9, BL_Tm: 6, Le_H: null, Znom_ohm: null}, 3, 'series', 'parallel');
    expect(p.Re_ohm).toBeCloseTo(1, 12);
    expect(p.BL_Tm).toBeCloseTo(2, 12);
  });

  // John, QO942.c64: "it must work for all counts" (bugs/BUG_20261116_coil-wiring-refuses-three-or-more-coils.md).
  it.each([[2], [3], [4]])('%s coils: series to parallel divides Re, Le and Znom by N squared and BL by N; parallel to series is the inverse', (n) => {
    const series: WiredMotor = {Re_ohm: 4.7, BL_Tm: 12.3, Le_H: 0.0015, Znom_ohm: 4};
    const p = converted(series, n, 'series', 'parallel');
    expect(p.Re_ohm).toBeCloseTo(4.7 / (n * n), 12);
    expect(p.Le_H).toBeCloseTo(0.0015 / (n * n), 12);
    expect(p.Znom_ohm).toBeCloseTo(4 / (n * n), 12);
    expect(p.BL_Tm).toBeCloseTo(12.3 / n, 12);
    const back = converted(p, n, 'parallel', 'series');
    expect(back.Re_ohm).toBeCloseTo(4.7, 12);
    expect(back.BL_Tm).toBeCloseTo(12.3, 12);
  });

  it.each([[2], [3], [4]])('%s coils with reBlOnly (WinISD): Re and BL convert, Le and Znom stay as published', (n) => {
    const r = convertWiring({Re_ohm: 4.7, BL_Tm: 12.3, Le_H: 0.0015, Znom_ohm: 4}, n, 'series', 'parallel', true);
    if (!r.converted) throw new Error(r.reason);
    expect(r.motor.Re_ohm).toBeCloseTo(4.7 / (n * n), 12);
    expect(r.motor.BL_Tm).toBeCloseTo(12.3 / n, 12);
    expect(r.motor.Le_H).toBe(0.0015);
    expect(r.motor.Znom_ohm).toBe(4);
  });

  it('is the driver area\'s own function', () => {
    expect(createEngine().driver.convertWiring).toBe(convertWiring);
  });
});
