import {describe, expect, it} from 'vitest';
import {type BoxType, createEngine} from '@openisd/design/engine';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '../../domain/index.js';

const scraped = <T,>(value: T) => ({value});
const spec = (read_value: number) => ({state: 'E' as const, value: read_value, origin: 'scraped', readings: {scraped: {read_value}}});

function project(): OpenISDProject {
  const engine = createEngine();
  const record = {
    uuid: {value: '00000000-0000-4000-8000-000000000000'},
    manufacturer: scraped('Dayton'), brand: scraped('Dayton'), model: scraped('RS225'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: {value: 'TEST-SKU', grounds: [{origin: 'manufacturer_datasheet', reading: 'TEST-SKU'}]},
    driver_type: scraped('woofer'),
    data_sources: {value: {manufacturer_datasheet: 'https://example.invalid/ds.pdf'}},
    quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []},
    specs: {woofer: {Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005), Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008)}},
  };
  const driver = OpenISDDriver.fromConformingRecord(record, engine);
  if (Array.isArray(driver)) throw new Error(driver.join(', '));
  return new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
}

/** The field each box type calls its main volume: the one cabinet for sealed, vented and PR, the
 *  rear chamber for the two-chamber boxes. */
describe('OpenISDBox.volumeOf(boxType) — the box type\'s own main-volume field', () => {
  const cases: readonly [BoxType, (box: OpenISDProject['box']) => {value: number | null}][] = [
    ['sealed', b => b.sealed.volume_m3],
    ['vented', b => b.vented.volume_m3],
    ['bandpass4', b => b.bandpass4.chambers.rear.volume_m3],
    ['bandpass6', b => b.bandpass6.chambers.rear.volume_m3],
    ['abc', b => b.abc.chambers.rear.volume_m3],
    ['box-passive-radiator', b => b.passiveRadiator.volume_m3],
  ];
  for (const [type, direct] of cases) {
    it(`${type}: writes through volumeOf and reads back on the type's own field`, () => {
      const box = project().box;
      box.volumeOf(type).set(0.0123456789);
      expect(direct(box).value).toBeCloseTo(0.0123456789, 12);
      expect(box.volumeOf(type).value).toBeCloseTo(0.0123456789, 12);
    });
  }
});

describe('OpenISDBox.frontVolumeOf / rearTuningOf / lossesOf — the other per-type fields the box tab shows', () => {
  it('front volume: the two-chamber types have one, the others none', () => {
    const box = project().box;
    box.frontVolumeOf('bandpass4')!.set(0.01);
    box.frontVolumeOf('bandpass6')!.set(0.02);
    box.frontVolumeOf('abc')!.set(0.03);
    expect(box.bandpass4.chambers.front.volume_m3.value).toBeCloseTo(0.01, 12);
    expect(box.bandpass6.chambers.front.volume_m3.value).toBeCloseTo(0.02, 12);
    expect(box.abc.chambers.front.volume_m3.value).toBeCloseTo(0.03, 12);
    for (const type of ['sealed', 'vented', 'box-passive-radiator'] as const) expect(box.frontVolumeOf(type)).toBeNull();
  });
  it('rear tuning: bandpass6 and abc tune the rear chamber, the others do not', () => {
    const box = project().box;
    box.rearTuningOf('bandpass6')!.set(40);
    box.rearTuningOf('abc')!.set(45);
    expect(box.bandpass6.chambers.rear.tuning_goal_hz.value).toBe(40);
    expect(box.abc.chambers.rear.tuning_goal_hz.value).toBe(45);
    for (const type of ['sealed', 'vented', 'bandpass4', 'box-passive-radiator'] as const) expect(box.rearTuningOf(type)).toBeNull();
  });
  it('losses: Ql/Qa of the one cabinet or rear chamber, Qp of the ported one; none for bandpass6/abc', () => {
    const box = project().box;
    const sealed = box.lossesOf('sealed')!;
    sealed.Ql.set(7); sealed.Qa.set(50);
    expect(box.sealed.losses.Ql.value).toBe(7);
    expect(box.sealed.losses.Qa.value).toBe(50);
    expect(sealed.Qp).toBeNull();
    const vented = box.lossesOf('vented')!;
    vented.Qp!.set(80);
    expect(box.vented.losses.Qp.value).toBe(80);
    const bp4 = box.lossesOf('bandpass4')!;
    bp4.Ql.set(9); bp4.Qp!.set(90);
    expect(box.bandpass4.chambers.rear.losses.Ql.value).toBe(9);
    expect(box.bandpass4.chambers.front.losses.Qp.value).toBe(90);
    expect(box.lossesOf('box-passive-radiator')!.Qp).toBeNull();
    expect(box.lossesOf('bandpass6')).toBeNull();
    expect(box.lossesOf('abc')).toBeNull();
  });
});
