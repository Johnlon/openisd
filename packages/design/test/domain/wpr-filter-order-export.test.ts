/**
 * `.wpr` export of a filter above order 10: WinISD's filter calculation overflows above order 10
 * (John, 2026-10-01; bugs/archive/BUG_20260927_winisd-wpr-filter-order-12-stops-load.md), so the export
 * writes order 10 and warns that it did. OpenISD's own project keeps the order it has.
 */
import {describe, expect, it} from 'vitest';
import {createEngine, type DriverError, type Filter} from '@openisd/design/engine';
import {ProjectBuilder, WinIsdProjectConverter} from '../../domain/index.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

function exported(filters: Filter[]) {
  const engine = createEngine();
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.filters.set(filters);
  project.save();
  const {value: wpr, errors} = new WinIsdProjectConverter(engine).winIsdProjectConverter(project);
  if (wpr === null) throw new Error('no .wpr produced');
  const back = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(wpr.toWpr());
  if (back.value === null) throw new Error('the .wpr did not read back');
  return {project, errors, filters: back.value.filters.value};
}

const orderWarnings = (errors: DriverError[]) => errors.filter(e => e.field === 'Filters' && /order/.test(e.message));

describe('.wpr export clamps a filter order above 10', () => {
  it('a lowpass of order 15 is written as order 10, with a warning naming both orders', () => {
    const {project, errors, filters} = exported(
      [{type: 'lowpass', enabled: true, family: 'butterworth', order: 15, fc: 50, Q: 0.707}]);
    expect(filters[0]).toMatchObject({type: 'lowpass', order: 10});
    const warns = orderWarnings(errors);
    expect(warns).toHaveLength(1);
    expect(warns[0].level).toBe('warn');
    expect(warns[0].message).toMatch(/15/);
    expect(warns[0].message).toMatch(/10/);
    expect(project.filters.value[0]).toMatchObject({order: 15});
  });

  it('an allpass of order 12 is written as order 10', () => {
    const {errors, filters} = exported([{type: 'allpass', enabled: true, order: 12, t: 0.001, Q: 0.5}]);
    expect(filters[0]).toMatchObject({type: 'allpass', order: 10});
    expect(orderWarnings(errors)).toHaveLength(1);
  });

  it('order 10 and below is written unchanged, with no warning', () => {
    const {errors, filters} = exported(
      [{type: 'highpass', enabled: true, family: 'bessel', order: 10, fc: 20, Q: 0.707}]);
    expect(filters[0]).toMatchObject({order: 10});
    expect(orderWarnings(errors)).toEqual([]);
  });
});
