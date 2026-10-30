import {describe, expect, it} from 'vitest';
import {type BoxType, createEngine} from '@openisd/design/engine';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';
import {ProjectSummary} from '../../domain/project/projectSummary.js';
import {NumberField} from '../../fields/field.js';
const scraped = <T,>(value: T) => ({value});
const spec = (read_value: number) => ({state: 'E' as const, value: read_value, origin: 'scraped', readings: {scraped: {read_value}}});

function project(sku = 'TEST-SKU'): OpenISDProject {
  const engine = createEngine();
  const record = {
    uuid: {value: '00000000-0000-4000-8000-000000000000'},
    manufacturer: scraped('Tang Band'), brand: scraped('Tang Band'), model: scraped('W5-1138SMF'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: {value: sku, grounds: [{origin: 'manufacturer_datasheet', reading: sku}]},
    driver_type: scraped(['woofer']),
    data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
    quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []},
    specs: {woofer: {Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005), Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008)}},
  };
  const driver = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driver)) throw new Error(driver.join(', '));
  return new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
}

/** A project of `type` with main volume `main_m3` and, for a two-chamber type, front `front_m3`. */
function projectOf(type: BoxType, main_m3: number, front_m3 = 0): OpenISDProject {
  const p = project();
  p.box.boxType.set(type);
  p.box.volumeOf(type).set(main_m3);
  p.box.frontVolumeOf(type)?.set(front_m3);
  return p;
}

const LITRES = {};

describe('ProjectSummary — the Open project list\'s second line', () => {
  const cases: readonly [BoxType, OpenISDProject, string][] = [
    ['sealed', projectOf('sealed', 0.02), 'Tang Band W5-1138SMF · Closed · 20.0 L'],
    ['vented', projectOf('vented', 0.012), 'Tang Band W5-1138SMF · Vented · 12.0 L'],
    ['box-passive-radiator', projectOf('box-passive-radiator', 0.015), 'Tang Band W5-1138SMF · Passive Radiator · 15.0 L'],
    ['bandpass4', projectOf('bandpass4', 0.012, 0.008), 'Tang Band W5-1138SMF · 4th Order Bandpass · 12.0 + 8.0 L'],
    ['bandpass6', projectOf('bandpass6', 0.01, 0.02), 'Tang Band W5-1138SMF · 6th Order Bandpass · 10.0 + 20.0 L'],
    ['abc', projectOf('abc', 0.03, 0.005), 'Tang Band W5-1138SMF · ABC · 30.0 + 5.0 L'],
  ];
  for (const [type, p, line] of cases) {
    it(`${type}: driver, the Box tab's type name, and the volume`, () => {
      expect(ProjectSummary.of(p).line(LITRES)).toBe(line);
    });
  }

  it('shows the volume in the unit the user rotated the box volume to', () => {
    const rotation = {[NumberField.BOX_VB_L.value]: 'cuft'};
    expect(ProjectSummary.of(projectOf('vented', 0.012)).line(rotation)).toBe('Tang Band W5-1138SMF · Vented · 0.42 cu ft');
    expect(ProjectSummary.of(projectOf('bandpass4', 0.012, 0.008)).line(rotation)).toBe('Tang Band W5-1138SMF · 4th Order Bandpass · 0.42 + 0.28 cu ft');
  });

  it('shows a dash for a blank or non-finite volume', () => {
    const blank = ProjectBuilder.empty(createEngine());
    blank.driver.specs.Vas_m3.clear();
    blank.box.volumeOf('sealed').clear();
    blank.driver.brand.set('Tang Band');
    blank.driver.model.set('W5-1138SMF');
    expect(ProjectSummary.of(blank).line(LITRES)).toBe('Tang Band W5-1138SMF · Closed · — L');
    const infinite = projectOf('abc', Infinity, 0.005);
    expect(ProjectSummary.of(infinite).line(LITRES)).toBe('Tang Band W5-1138SMF · ABC · — + 5.0 L');
  });

  describe('phoneLine: the driver short code, upper-cased, in place of brand and model', () => {
    it('shows the sku upper-cased before box and volume', () => {
      const p = project('e150he-44');
      p.box.boxType.set('sealed');
      p.box.volumeOf('sealed').set(0.0035);
      expect(ProjectSummary.of(p).phoneLine(LITRES)).toBe('E150HE-44 · Closed · 3.5 L');
    });
    it('falls back to the model text when the sku is blank', () => {
      const p = project('');
      p.box.boxType.set('sealed');
      p.box.volumeOf('sealed').set(0.0035);
      expect(ProjectSummary.of(p).phoneLine(LITRES)).toBe('Tang Band W5-1138SMF · Closed · 3.5 L');
    });
  });
});


it('provides box type and volumes separately for multiline desktop project rows', () => {
  expect(ProjectSummary.of(projectOf('bandpass6', 0.012, 0.008)).boxDetails({})).toEqual({type:'6th Order Bandpass', volumes:'12.0 + 8.0 L'});
  expect(ProjectSummary.of(projectOf('vented', 0.012)).boxDetails({[NumberField.BOX_VB_L.value]:'cuft'})).toEqual({type:'Vented', volumes:'0.42 cu ft'});
});
