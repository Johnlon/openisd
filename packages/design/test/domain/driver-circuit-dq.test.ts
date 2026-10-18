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

  it('flags a typed BL that disagrees with Qes even when no Mms is typed (the conflict shows on Fs, Mms and Cms)', () => {
    const driver = driverFromSpec(engine, {...LIBRARY, BL_Tm: 5});
    expect(driver.specs.BL_Tm.provenance).toBe('E');
    expect(driver.issues().some(i => i.kind === 'inconsistent-inputs')).toBe(true);
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
