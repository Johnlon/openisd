import {describe, it, expect} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {type Engine, createEngine, type DriverError} from '@openisd/design/engine';
import type {Filter} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '@openisd/design';
import {WinIsdProjectConverter} from '../../domain/winIsdProjectConverter.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const here = dirname(fileURLToPath(import.meta.url));

// A real WinISD-written `.wpr` with a [Filters] section (2 entries): the sample this bridge's
// own doc points at.
const SAMPLE_PASSIVE_RADIATOR_WPR = join(here, '..', '..', '..', '..', 'docs', 'samples', 'sample_project_passive-radiator.wpr');

// 20 filters, every WinISD type and every low/highpass subtype, none missing/malformed
// (winisd_research/runs/filt-all-1/w5.wpr — copied per this task's own brief).
const MANY_FILTERS_WPR = join(here, 'fixtures', 'filters', 'many-filters.wpr');

/** `[ProjectInfo]`/`[Driver]`/`[Box]` boilerplate for a filter-import test that only cares about
 *  `[Filters]` — a minimal sealed box, matching the other inline-text tests in this file. */
const FILTERS_TEST_BASE = '[ProjectInfo]\n[Driver]\nBrand=Test\nModel=Driver\n[Box]\nBType=0\nVr=0.02\n';

const scraped = <T,>(value: T) => ({ value });

const num = (read_value: number) => ({ state: 'E' as const, value: read_value, origin: 'test', readings: { test: { read_value } } });

/** The QO8/sealed-small etc. driver every golden's `[Driver]` block carries — same Fs/Sd/Cms/
 *  Qms/Mms/Rms/Xmax/Re/Le/BL/Qes values across all four goldens (only Brand/Model differ, and
 *  those are not asserted here — the bridge test compares [Box]/[PassiveRadiator]/[SignalSource]
 *  values, matching `winisdProject.test.ts`'s own scope, which also does not byte-match
 *  [Driver]). */
function aDriver(engine: Engine, brand: string, model: string): OpenISDDriver {
  const record = {
    brand: scraped(brand), model: scraped(model), manufacturer: scraped(brand),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs_hz: num(37.2), Sd_m2: num(0.0132), Cms_m_per_N: num(0.00118092600256716),
        Mms_kg: num(0.0155), Rms_kg_per_s: num(0.953390696873618), Xmax_m: num(0.006),
        Re_ohm: num(6.4), Le_H: num(0.0005), BL_Tm: num(7.5), Qms: num(3.8),
        Qes: num(0.412203764408292), Qts: num(0.371865748278097),
      },
    },
  };
  const driver = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driver)) throw new Error(`fixture is not a conforming driver: ${driver.join('; ')}`);
  return driver;
}

function aProject(box: (p: ProjectBuilder) => OpenISDProject): OpenISDProject {
  const engine = createEngine();
  return box(new ProjectBuilder(aDriver(engine, 'QO8', 'test'), engine));
}

function exported(filters: Filter[]) {
  const engine = createEngine();
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Re_ohm: 6,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.filters.set(filters);
  project.save();
  const {value: wpr, errors} = new WinIsdProjectConverter(engine).openIsdProjectToWinIsdProject(project);
  if (wpr === null) throw new Error('no .wpr produced');
  const back = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(wpr.toWpr());
  if (back.value === null) throw new Error('the .wpr did not read back');
  return {project, errors, filters: back.value.filters.value};
}

const orderWarnings = (errors: DriverError[]) => errors.filter(e => e.field === 'Filters' && /order/.test(e.message));

describe('.wpr [Filters]', () => {
  describe('openIsdProjectToWinIsdProject — [Filters] export', () => {
    const ONE_OF_EVERY_EXPORTABLE_TYPE: Filter[] = [
      {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
      {type: 'highpass', enabled: false, family: 'bessel', order: 3, fc: 20, Q: 0.6},
      {type: 'allpass', enabled: true, order: 1, t: 0.001, Q: 0.707},
      {type: 'linkwitz', enabled: true, f0: 67.234, Q0: 0.49, fp: 20, Qp: 0.707},
      {type: 'peaking', enabled: true, fc: 30, Q: 2, gain: 6},
      {type: 'peakHighpass', enabled: true, fpk: 20, gainPk: 6},
      {type: 'staticGain', enabled: true, gain: -3},
      {type: 'raisedCosine', enabled: true, fc: 100, bwOct: 0.333, gain: 6},
    ];

    it('writes Count and filter<i>type/params for every filter, in order', () => {
      const project = aProject((p) => p.sealed().volume_m3(0.02).build());
      project.filters.set(ONE_OF_EVERY_EXPORTABLE_TYPE);

      const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
      assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
      if (!wpr) throw new Error('expected a WinISDProject');

      assert.equal(wpr.number('Filters', 'Count'), 8);
      assert.equal(wpr.value('Filters', 'filter0type'), '0');
      assert.equal(wpr.value('Filters', 'filter0params'), '0;1;2;50;0.707');
      assert.equal(wpr.value('Filters', 'filter1type'), '1');
      assert.equal(wpr.value('Filters', 'filter1params'), '2;0;3;20;0.6'); // enabled=false -> 0
      assert.equal(wpr.value('Filters', 'filter7type'), '7');
      assert.equal(wpr.value('Filters', 'filter7params'), '0;1;100;0.333;6');
    });

    it('round-trips one of every exportable type through .wpr text back to the same Filter values', () => {
      const project = aProject((p) => p.sealed().volume_m3(0.02).build());
      project.filters.set(ONE_OF_EVERY_EXPORTABLE_TYPE);

      const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
      assert.equal(errors.length, 0, `expected no errors, got: ${JSON.stringify(errors)}`);
      if (!wpr) throw new Error('expected a WinISDProject');

      const {value: reimported, errors: importErrors} = new WinIsdProjectConverter(createEngine()).winIsdProjectToOpenIsdProject(wpr.toWpr());
      const filterWarnings = importErrors.filter((e) => e.field === 'Filters');
      assert.equal(filterWarnings.length, 0, `expected no [Filters] warnings, got: ${JSON.stringify(filterWarnings)}`);
      if (!reimported) throw new Error('expected a project');

      assert.deepEqual(reimported.filters.value, ONE_OF_EVERY_EXPORTABLE_TYPE);
    });

    it('low/high shelf are skipped, each with its own warn, and do not gap Count\'s numbering', () => {
      const project = aProject((p) => p.sealed().volume_m3(0.02).build());
      project.filters.set([
        {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
        {type: 'lowshelf', enabled: true, fc: 150, Q: Math.SQRT1_2, gain: 6},
        {type: 'highpass', enabled: true, family: 'butterworth', order: 2, fc: 20, Q: 0.707},
        {type: 'highshelf', enabled: true, fc: 2000, Q: Math.SQRT1_2, gain: 6},
      ]);

      const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
      if (!wpr) throw new Error('expected a WinISDProject');

      assert.equal(wpr.number('Filters', 'Count'), 2);
      assert.equal(wpr.value('Filters', 'filter0type'), '0');
      assert.equal(wpr.value('Filters', 'filter1type'), '1');
      assert.equal(wpr.value('Filters', 'filter2type'), undefined);
      assert.ok(errors.some((e) => e.level === 'warn' && e.message === 'low shelf not written: WinISD has no shelf filter'));
      assert.ok(errors.some((e) => e.level === 'warn' && e.message === 'high shelf not written: WinISD has no shelf filter'));
    });

    it('an empty filter chain writes Count=0 and no filter<i> keys', () => {
      const project = aProject((p) => p.sealed().volume_m3(0.02).build());

      const {value: wpr, errors} = new WinIsdProjectConverter(createEngine()).openIsdProjectToWinIsdProject(project);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      if (!wpr) throw new Error('expected a WinISDProject');
      assert.equal(wpr.number('Filters', 'Count'), 0);
      assert.equal(wpr.value('Filters', 'filter0type'), undefined);
    });
  });

  describe('winIsdProjectToOpenIsdProject — [Filters] import', () => {
    it('the real passive-radiator sample imports its own two filters exactly', () => {
      const text = readFileSync(SAMPLE_PASSIVE_RADIATOR_WPR, 'utf8');
      const engine = createEngine();
      const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      const filterWarnings = errors.filter((e) => e.field === 'Filters');
      assert.equal(filterWarnings.length, 0, `expected no [Filters] warnings, got: ${JSON.stringify(filterWarnings)}`);
      if (!project) throw new Error('expected a project');

      assert.deepEqual(project.filters.value, [
        {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
        {type: 'raisedCosine', enabled: true, fc: 100, bwOct: 0.333, gain: 6},
      ]);
    });

    it('a WinISD-written many-filter file imports every type and every low/highpass subtype', () => {
      const text = readFileSync(MANY_FILTERS_WPR, 'utf8');
      const engine = createEngine();
      const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      const filterWarnings = errors.filter((e) => e.field === 'Filters');
      assert.equal(filterWarnings.length, 0, `expected no [Filters] warnings, got: ${JSON.stringify(filterWarnings)}`);
      if (!project) throw new Error('expected a project');

      assert.deepEqual(project.filters.value, [
        {type: 'lowpass', enabled: true, family: 'butterworth', order: 4, fc: 80, Q: 0.707},
        {type: 'lowpass', enabled: true, family: 'linkwitzRiley', order: 4, fc: 80, Q: 0.707},
        {type: 'lowpass', enabled: true, family: 'bessel', order: 3, fc: 80, Q: 0.707},
        {type: 'lowpass', enabled: true, family: 'sos', order: 2, fc: 80, Q: 1.2},
        {type: 'highpass', enabled: true, family: 'butterworth', order: 5, fc: 25, Q: 0.707},
        {type: 'highpass', enabled: true, family: 'linkwitzRiley', order: 4, fc: 25, Q: 0.707},
        {type: 'highpass', enabled: true, family: 'bessel', order: 4, fc: 25, Q: 0.707},
        {type: 'highpass', enabled: true, family: 'sos', order: 2, fc: 25, Q: 0.9},
        {type: 'allpass', enabled: true, order: 1, t: 0.002, Q: 0.707},
        {type: 'allpass', enabled: true, order: 2, t: 0.003, Q: 0.6},
        {type: 'linkwitz', enabled: true, f0: 67.234, Q0: 0.49, fp: 25, Qp: 0.6},
        {type: 'peaking', enabled: true, fc: 45, Q: 3, gain: -4},
        {type: 'peakHighpass', enabled: true, fpk: 22, gainPk: 4},
        {type: 'staticGain', enabled: true, gain: -3},
        {type: 'raisedCosine', enabled: true, fc: 120, bwOct: 0.5, gain: 5},
        {type: 'lowpass', enabled: true, family: 'butterworth', order: 1, fc: 200, Q: 0.707},
        {type: 'lowpass', enabled: true, family: 'butterworth', order: 10, fc: 300, Q: 0.707},
        {type: 'lowpass', enabled: true, family: 'bessel', order: 10, fc: 300, Q: 0.707},
        {type: 'highpass', enabled: true, family: 'bessel', order: 1, fc: 15, Q: 0.707},
        {type: 'lowpass', enabled: true, family: 'sos', order: 4, fc: 150, Q: 0.8},
      ]);
    });

    it('an entry whose filter<i>type/params keys are both missing loads as WinISD\'s own default lowpass, with a warn', () => {
      const text = FILTERS_TEST_BASE
        + '[Filters]\nCount=2\nfilter0type=0\nfilter0params=0;1;2;50;0.707\n';
      const engine = createEngine();
      const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));

      assert.deepEqual(project.filters.value, [
        {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
        {type: 'lowpass', enabled: true, family: 'butterworth', order: 2, fc: 50, Q: 0.707},
      ]);
      assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'Filters'
        && e.message === 'filter 1 missing — WinISD loads it as its default lowpass'));
    });

    it('a params line with the wrong field count loads as that type\'s own default, enabled kept from the line, with a warn', () => {
      // Measured: runs/filter-allpass-1 — a 4-field allpass (missing Q) loads as n=1, t=0.001.
      const text = FILTERS_TEST_BASE
        + '[Filters]\nCount=1\nfilter0type=2\nfilter0params=0;1;3;2.0E-003\n';
      const engine = createEngine();
      const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));

      assert.deepEqual(project.filters.value, [
        {type: 'allpass', enabled: true, order: 1, t: 0.001, Q: 0.707},
      ]);
      assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'Filters'
        && e.message === 'filter 0: allpass params malformed — WinISD loads it as its default allpass'));
    });

    it('an unknown filter type number is skipped outright, with a warn', () => {
      const text = FILTERS_TEST_BASE
        + '[Filters]\nCount=1\nfilter0type=9\nfilter0params=0;1;2;50;0.707\n';
      const engine = createEngine();
      const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));

      assert.deepEqual(project.filters.value, []);
      assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'Filters'
        && e.message === 'filter 0: unknown filter type 9 — skipped'));
    });

    it('a low/highpass subtype above 3 is skipped outright, with a warn', () => {
      const text = FILTERS_TEST_BASE
        + '[Filters]\nCount=1\nfilter0type=0\nfilter0params=4;1;2;50;0.707\n';
      const engine = createEngine();
      const {value: project, errors} = new WinIsdProjectConverter(engine).winIsdProjectToOpenIsdProject(text);
      if (!project) throw new Error('expected a project: ' + JSON.stringify(errors));

      assert.deepEqual(project.filters.value, []);
      assert.ok(errors.some((e) => e.level === 'warn' && e.field === 'Filters'
        && e.message === 'filter 0: unsupported lowpass subtype — skipped'));
    });
  });

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
});
