import { solvePrConsistencyGroup, solveVentConsistencyGroup } from './engine/testSolver.js';
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

describe('PR and Vent Solver Groups', () => {
  it('PR solver group derives C/N/E state, value and structural DQ atomically', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson(), new Engine());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    // S2-7d2: the project cascade only solves the ACTIVE box type's vent/PR pair, and
    // `systemTuning_hz` is now one of `solvePr`'s own outputs — it needs a stated `addedMass_kg`
    // (0 = bare cone) to have anything to derive FROM, unlike the old bespoke getter, which
    // defaulted an unstated mass to 0 internally.
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;

    p.box.passiveRadiator.addedMass_kg.clear();
    p.box.passiveRadiator.tuning_hz.set(ceiling * 1.5);
    p.notifyPrChanged();

    const massCell = p.box.passiveRadiator.addedMass_kg.get();
    const tuningCell = p.box.passiveRadiator.tuning_hz.get();

    expect(massCell.state).toBe('calculated');
    expect(tuningCell.state).toBe('entered');
    expect(massCell.value).toBeLessThan(0);
    const DQ = [
      'addedMass_kg, tuning_hz disagree by 100%: Target tuning is above maximum passive radiator tuning. '
      + 'Every field in the group is marked — correct one of them, or clear one to let it be calculated.',
    ];
    expect(massCell.dq()).toEqual(DQ);
    expect(tuningCell.dq()).toEqual(DQ);
  });

  it('Vent solver group derives C/N/E state, value and structural DQ atomically', () => {
    const p = project();
    p.box.boxType.set('vented');
    p.box.vented.volume_m3.set(0.03);
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.05);
    p.box.vented.vent.endCorrection_m.set(0.6);
    p.box.vented.vent.length_m.clear();
    p.box.vented.tuning_hz.set(35);
    p.notifyVentChanged();

    const lenCell = p.box.vented.vent.length_m.get();
    const tuningCell = p.box.vented.tuning_hz.get();

    expect(tuningCell.state).toBe('entered');
    expect(lenCell.state).toBe('calculated');
    expect(lenCell.value).toBeGreaterThan(0);
    expect(lenCell.dq()).toEqual([]);
    expect(tuningCell.dq()).toEqual([]);
  });

  it('Engine exposes pure solveDriverConsistencyGroup, and notifyVentChanged', () => {
    const prSolved = solvePrConsistencyGroup({
      tuning_hz: 50,
      Vb_m3: 0.03,
      prMmd_kg: 0.09,
      prSd_m2: 0.025,
      prCms_m_per_N: 0.0009,
      prNum: 1,
    });
    expect(prSolved.addedMass_kg).toBeDefined();

    const ventSolved = solveVentConsistencyGroup({
      tuning_hz: 35,
      Vb_m3: 0.03,
      area_m2: 0.002,
      endCorrection_m: 0.6,
    });
    expect(ventSolved.length_m).toBeGreaterThan(0);
  });

  it('preserves Entered (E) fields while allowing solver write-backs on C/N fields', () => {
    const p = project();
    p.box.boxType.set('vented');
    p.box.vented.volume_m3.set(0.03);
    p.box.vented.vent.diameter_m.set(0.05);
    p.box.vented.vent.endCorrection_m.set(0.6);

    // Human enters length (E)
    p.box.vented.vent.length_m.set(0.15);
    p.box.vented.tuning_hz.clear();

    p.notifyVentChanged();

    // length_m must remain entered (E) and untouched by solver
    expect(p.box.vented.vent.length_m.get().state).toBe('entered');
    expect(p.box.vented.vent.length_m.get().value).toBe(0.15);

    // tuning_hz must be calculated (C) by solver
    expect(p.box.vented.tuning_hz.get().state).toBe('calculated');
    expect(p.box.vented.tuning_hz.get().value).toBeGreaterThan(0);
  });

  it('transitions C -> N when required inputs are cleared', () => {
    const p = project();
    p.box.boxType.set('vented');
    p.box.vented.volume_m3.set(0.03);
    p.box.vented.vent.diameter_m.set(0.05);
    p.box.vented.vent.endCorrection_m.set(0.6);
    p.box.vented.tuning_hz.set(35);

    p.notifyVentChanged();
    expect(p.box.vented.vent.length_m.get().state).toBe('calculated');

    // Clear required input (tuning_hz)
    p.box.vented.tuning_hz.clear();
    p.notifyVentChanged();

    // length_m should transition from C -> N (not-available)
    expect(p.box.vented.vent.length_m.get().state).toBe('not-available');
    expect(p.box.vented.vent.length_m.get().value).toBeNull();
  });
});

