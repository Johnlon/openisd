import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import {availableAir} from '../../engine/index.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {driverParams, sweepDriver} from './testSolver.js';

const engine = createEngine();

describe('DriverEngine.circuitValues with figures too extreme to compute from', () => {
  it('keeps the stated Cms when Vas and Sd give a compliance that overflows', () => {
    // Sd² underflows to 0, so Vas / (rho·c²·Sd²) is Infinity: not a usable compliance.
    const values = sweepDriver({Vas_m3: 1, Sd_m2: 1e-200, Cms_m_per_N: 0.009}).values;
    expect(engine.driver.circuitValues(values, REFERENCE_AIR).Cms_m_per_N).toBe(0.009);
  });
});

describe('DriverEngine.solve widths', () => {
  const STATED = {Fs_hz: 40, Qes: 0.5, Qms: 4, Vas_m3: 0.02, Sd_m2: 0.0132, Re_ohm: 6};

  it('gives a width to every derived figure even when the lower nudge of an entered one is negative', () => {
    // Fs half-width 1e6: the lower nudge is Fs - 1e3 < 0, where some derived figures have no value.
    const params = driverParams(STATED);
    const fs = params.Fs_hz;
    const wide = {...params, Fs_hz: {...fs, get value() { return fs.value; }, get precision() { return 1e6; }}};
    engine.driver.solve(wide, availableAir(REFERENCE_AIR));
    const narrow = driverParams(STATED);
    engine.driver.solve(narrow, availableAir(REFERENCE_AIR));
    expect(params.Qts.value).toBeCloseTo(0.5 * 4 / 4.5, 12);
    // Qts does not depend on Fs, so Fs's width adds nothing to it.
    expect(params.Qts.precision).toBe(narrow.Qts.precision);
    expect(Number.isFinite(params.Mms_kg.precision)).toBe(true);
  });
});
