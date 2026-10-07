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

describe('OpenISDBox.frontVolumeOf / rearTuningOf / lossGroupsOf — the other per-type fields the box tab shows', () => {
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
  it('losses: one set for the one-cabinet types, Ql/Qa of the cabinet, Qp of the ported one, no Qicl', () => {
    const box = project().box;
    const [sealed] = box.lossGroupsOf('sealed');
    expect(box.lossGroupsOf('sealed')).toHaveLength(1);
    expect(sealed!.heading).toBeNull();
    sealed!.Ql.set(7); sealed!.Qa.set(50);
    expect(box.sealed.losses.Ql.value).toBe(7);
    expect(box.sealed.losses.Qa.value).toBe(50);
    expect(sealed!.Qp).toBeNull();
    const [vented] = box.lossGroupsOf('vented');
    vented!.Qp!.set(80);
    expect(box.vented.losses.Qp.value).toBe(80);
    expect(box.lossGroupsOf('box-passive-radiator')[0]!.Qp).toBeNull();
    for (const type of ['sealed', 'vented', 'box-passive-radiator'] as const) expect(box.lossGroupsOf(type)[0]!.Qicl).toBeNull();
  });
  // bugs/BUG_20261007_4th-order-bandpass-merges-per-chamber-losses.md; WinISD probe e7c754c:
  // the rear chamber panel has Ql, Qa, Qicl (no Qp), the front has Ql, Qa, Qp, Qicl.
  it('losses: bandpass4 has a Rear chamber set (Ql, Qa, no Qp) and a Front chamber set (Ql, Qa, Qp)', () => {
    const box = project().box;
    const [rear, front] = box.lossGroupsOf('bandpass4');
    expect(box.lossGroupsOf('bandpass4')).toHaveLength(2);
    expect(rear!.heading).toBe('Rear chamber');
    expect(front!.heading).toBe('Front chamber');
    expect(rear!.Qp).toBeNull();
    rear!.Ql.set(7); rear!.Qa.set(30);
    front!.Ql.set(9); front!.Qa.set(50); front!.Qp!.set(60);
    const {rear: r, front: f} = box.bandpass4.chambers;
    expect([r.losses.Ql.value, r.losses.Qa.value]).toEqual([7, 30]);
    expect([f.losses.Ql.value, f.losses.Qa.value, f.losses.Qp.value]).toEqual([9, 50, 60]);
  });
  it('resetLossesOf(bandpass4) puts both chambers back to WinISD\'s defaults', () => {
    const box = project().box;
    for (const g of box.lossGroupsOf('bandpass4')) { g.Ql.set(3); g.Qa.set(4); g.Qp?.set(5); g.Qicl!.set(6); }
    box.resetLossesOf('bandpass4');
    const [rear, front] = box.lossGroupsOf('bandpass4');
    expect([rear!.Ql.value, rear!.Qa.value, rear!.Qicl!.value]).toEqual([10, 100, 100]);
    expect([front!.Ql.value, front!.Qa.value, front!.Qp!.value, front!.Qicl!.value]).toEqual([10, 100, 100, 100]);
  });
  // WinISD shows ONE Qicl (its Qiclfr) in every chamber panel; the engine reads the rear chamber's.
  for (const type of ['bandpass4', 'bandpass6', 'abc'] as const) {
    it(`losses: ${type}'s Rear and Front sets edit the one Qicl the sweep reads (the rear chamber's)`, () => {
      const box = project().box;
      const [rear, front] = box.lossGroupsOf(type);
      expect(front!.Qicl).toBe(rear!.Qicl);
      front!.Qicl!.set(42);
      expect(box[type].chambers.rear.losses.Qicl.value).toBe(42);
      expect(rear!.Qicl!.value).toBe(42);
    });
  }
  // bugs/BUG_20261006_box-losses-popup-blank-for-6th-and-abc.md: WinISD gives each chamber its own losses.
  for (const type of ['bandpass6', 'abc'] as const) {
    it(`losses: ${type} has a Rear chamber set and a Front chamber set, each with Ql, Qa and Qp`, () => {
      const box = project().box;
      const [rear, front] = box.lossGroupsOf(type);
      expect(box.lossGroupsOf(type)).toHaveLength(2);
      expect(rear!.heading).toBe('Rear chamber');
      expect(front!.heading).toBe('Front chamber');
      rear!.Ql.set(7); rear!.Qa.set(30); rear!.Qp!.set(40);
      front!.Ql.set(9); front!.Qa.set(50); front!.Qp!.set(60);
      const chambers = box[type].chambers;
      expect([chambers.rear.losses.Ql.value, chambers.rear.losses.Qa.value, chambers.rear.losses.Qp.value]).toEqual([7, 30, 40]);
      expect([chambers.front.losses.Ql.value, chambers.front.losses.Qa.value, chambers.front.losses.Qp.value]).toEqual([9, 50, 60]);
    });
    it(`resetLossesOf(${type}) puts both chambers back to WinISD's defaults`, () => {
      const box = project().box;
      for (const g of box.lossGroupsOf(type)) { g.Ql.set(3); g.Qa.set(4); g.Qp!.set(5); g.Qicl!.set(6); }
      box.resetLossesOf(type);
      for (const g of box.lossGroupsOf(type)) expect([g.Ql.value, g.Qa.value, g.Qp!.value, g.Qicl!.value]).toEqual([10, 100, 100, 100]);
    });
  }
});
