/**
 * What a driver's data-quality marks say about the circuit (John, 18 Oct 2026): a typed Cms or Mms stays
 * entered, but is marked when it disagrees with what the T/S values imply; a driver with only Qts is
 * marked as drawing approximate charts, and still draws them.
 */
import {describe, expect, it} from 'vitest';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {createEngine} from '../../engine/Engine.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const engine = createEngine();
const LIBRARY = {Fs_hz: 45, Qes: 0.57, Qms: 3.56, Vas_m3: 0.00485, Sd_m2: 0.0094, Re_ohm: 3.4, BL_Tm: 7.17};

describe('OpenISDDriver data quality for the circuit', () => {
  it('keeps a typed Cms entered and marks it when it disagrees with Vas and Sd', () => {
    const driver = driverFromSpec(engine, {...LIBRARY, Cms_m_per_N: 0.0009});
    expect(driver.specs.Cms_m_per_N.provenance).toBe('E');
    expect(driver.specs.Cms_m_per_N.dq.some(i => i.kind === 'inconsistent-inputs')).toBe(true);
  });

  it('keeps a typed Mms entered and marks it when it disagrees with Fs and Cms', () => {
    const driver = driverFromSpec(engine, {...LIBRARY, Mms_kg: 0.2});
    expect(driver.specs.Mms_kg.provenance).toBe('E');
    expect(driver.specs.Mms_kg.dq.some(i => i.kind === 'inconsistent-inputs')).toBe(true);
  });

  it('keeps a typed BL entered and marks it when it disagrees with Qes, Fs, Mms and Re', () => {
    const driver = driverFromSpec(engine, {...LIBRARY, Cms_m_per_N: 0.00036872, Mms_kg: 0.02881, BL_Tm: 5});
    expect(driver.specs.BL_Tm.provenance).toBe('E');
    expect(driver.specs.BL_Tm.dq.some(i => i.kind === 'inconsistent-inputs')).toBe(true);
  });

  it('marks a typed BL that disagrees with Qes, Fs, Re and Vas, with no Mms typed', () => {
    const driver = driverFromSpec(engine, {...LIBRARY, BL_Tm: 5});
    expect(driver.specs.BL_Tm.provenance).toBe('E');
    expect(driver.specs.BL_Tm.dq.some(i => i.kind === 'inconsistent-inputs')).toBe(true);
  });

  it('does not mark a typed BL that sits within datasheet rounding of the BL Qes, Fs, Re and Vas imply', () => {
    // The implied BL for LIBRARY is 7.3046; 7.17 is a datasheet value 1.8% under it.
    const driver = driverFromSpec(engine, {...LIBRARY, BL_Tm: 7.17});
    expect(driver.specs.BL_Tm.dq.some(i => i.kind === 'inconsistent-inputs')).toBe(false);
  });

  it('marks a wrong Mms on the Fs, Mms, Cms group only, not on the BL group that Mms drags a computed BL out of', () => {
    const driver = driverFromSpec(engine, {Fs_hz: 37, Qes: 0.4156, Qms: 4.5, Vas_m3: 0.03, Sd_m2: 0.0212, Re_ohm: 6.6, Mms_kg: 0.2});
    expect(driver.specs.BL_Tm.provenance).toBe('C');
    const groups = (f: 'Fs_hz' | 'Mms_kg' | 'Cms_m_per_N' | 'Re_ohm' | 'BL_Tm') =>
      driver.specs[f].dq.flatMap(i => (i.kind === 'inconsistent-inputs' ? [i.fields] : []));
    for (const f of ['Fs_hz', 'Mms_kg', 'Cms_m_per_N'] as const) {
      expect(groups(f)).toContainEqual(['Fs_hz', 'Mms_kg', 'Cms_m_per_N']);
    }
    expect(groups('Re_ohm')).toEqual([]);
    expect(groups('BL_Tm')).toEqual([]);
  });

  it('marks a driver with only Qts as approximate, and still draws its charts', () => {
    const {Qes: _qes, Qms: _qms, ...withoutQ} = LIBRARY;
    const driver = driverFromSpec(engine, {...withoutQ, Qts: 0.49});
    expect(driver.specs.Qts.dq.some(i => i.kind === 'approximate-charts')).toBe(true);
    expect(driver.dataQualityWarnings().some(w => w.field === 'Qts' && /approximate/.test(w.message))).toBe(true);
    expect(driver.chartBlockingReasons()).toEqual([]);
    const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.006).build();
    expect(project.sweep({fmin: 10, fmax: 1000}).values).not.toBeNull();
  });
});
