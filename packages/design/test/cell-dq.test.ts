import { describe, it, expect } from 'vitest';
import { OpenISDProject, OpenISDDriver, OpenISDPassiveRadiatorStandalone } from '../domain/openisdDomain.js';
import { Engine } from '../engine/index.js';
const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ origin: 'scraped', readings: { scraped: { read_value } } });

function specSection(p: {
  Fs_hz: number; Qts: number; Sd_m2: number; Cms_m_per_N: number;
  Mmd_kg: number; Rms_Ns_per_m: number; Xmax_m: number;
}) {
  return {
    Fs_hz: spec(p.Fs_hz), Qts: spec(p.Qts), Sd_m2: spec(p.Sd_m2), Cms_m_per_N: spec(p.Cms_m_per_N),
    Mms_kg: spec(p.Mmd_kg), Rms_kg_per_s: spec(p.Rms_Ns_per_m), Xmax_m: spec(p.Xmax_m),
  };
}

function prSpecSection(p: {
  Fs_hz: number; Sd_m2: number; Cms_m_per_N: number;
  Mmd_kg: number; Rms_Ns_per_m: number; Xmax_m: number;
}) {
  return {
    Fs_hz: spec(p.Fs_hz), Sd_m2: spec(p.Sd_m2), Cms_m_per_N: spec(p.Cms_m_per_N),
    Mms_kg: spec(p.Mmd_kg), Rms_kg_per_s: spec(p.Rms_Ns_per_m), Xmax_m: spec(p.Xmax_m),
  };
}

function driverFrom(p: Parameters<typeof driverJson>[0]) {
  const result = OpenISDDriver.fromConformingRecord(driverJson(p), new Engine());
  if (Array.isArray(result)) throw new Error(`fixture is not a valid driver: ${result.join(', ')}`);
  return result;
}

function driverJson(p: {
  brand: string; model: string; section: 'woofer' | 'tweeter' | 'passive-radiator';
  spec: ReturnType<typeof specSection> | ReturnType<typeof prSpecSection>;
}) {
  const meta = {
    brand: scraped(p.brand), model: scraped(p.model), manufacturer: scraped(p.brand),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
  };
  if (p.section === 'woofer') return { ...meta, specs: { woofer: p.spec } };
  if (p.section === 'tweeter') return { ...meta, specs: { tweeter: p.spec } };
  return { ...meta, specs: { 'passive-radiator': p.spec } };
}

function project() {
  return OpenISDProject.builder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), new Engine()).sealed().volume_m3(0.03).build();
}

function prJson() {
  return driverJson({
    brand: 'Dayton', model: 'PR250', section: 'passive-radiator',
    spec: prSpecSection({ Fs_hz: 12, Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
  });
}

describe('structural DQ on Cell<T>', () => {
  it('exposes dq() on Cell<T> returning an empty array for valid fields', () => {
    const p = project();
    const cell = p.box.vented.volume_m3.get();
    expect(typeof cell.dq).toBe('function');
    expect(cell.dq()).toEqual([]);
  });

  it('exposes dq() on PR addedMass_kg and tuning_hz for unreachable tuning target', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    // S2-7d2: the project cascade only solves the ACTIVE box type's vent/PR pair.
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;

    p.box.passiveRadiator.addedMass_kg.clear();
    p.box.passiveRadiator.tuning_hz.set(ceiling * 1.5);
    p.notifyPrChanged();

    const massCell = p.box.passiveRadiator.addedMass_kg.get();
    const tuningCell = p.box.passiveRadiator.tuning_hz.get();

    expect(massCell.value).toBeLessThan(0);
    expect(massCell.dq()).not.toEqual([]);
    expect(tuningCell.dq()).not.toEqual([]);
    expect(massCell.dq()).toEqual(tuningCell.dq());

    // Reset to reachable tuning
    p.box.passiveRadiator.tuning_hz.set(ceiling);
    p.notifyPrChanged();

    expect(p.box.passiveRadiator.addedMass_kg.get().dq()).toEqual([]);
    expect(p.box.passiveRadiator.tuning_hz.get().dq()).toEqual([]);
  });
});
