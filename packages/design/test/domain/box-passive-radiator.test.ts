import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {radiatorFromSpec} from '../fixtures/recordBuilders.js';
import {OpenISDPassiveRadiatorStandalone, ProjectBuilder} from '../../domain/index.js';
import {fixedAppContext, fixtureEngine, specSection, prSpecSection, driverFrom, driverJson} from '../fixtures/domainBuilders.js';

describe('the passive radiator a box holds', () => {
  const prJson = () => driverJson({
    brand: 'SB Acoustics', model: 'SB23PACS', section: 'passive-radiator',
    spec: prSpecSection({ Fs_hz: 1 / (2 * Math.PI * Math.sqrt(0.09 * 0.0009)), Sd_m2: 0.025, Cms_m_per_N: 0.0009, Mmd_kg: 0.09, Rms_Ns_per_m: 1.5, Xmax_m: 0.015 }),
  });
  const project = () => new ProjectBuilder(driverFrom({
    brand: 'Dayton', model: 'RS225', section: 'woofer',
    spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
  }), createEngine()).sealed().volume_m3(0.03).build();

  it('holds a blank radiator from the start: blank reads, and edits land', () => {
    const p = project();
    const r = p.box.passiveRadiator.radiator;

    expect(r.brand.value).toBe('');
    r.brand.set('SB');
    expect(p.box.passiveRadiator.radiator.brand.value).toBe('SB');

    expect(r.spec.Fs_hz.value).toBe(null);
    r.spec.Fs_hz.set(12);
    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(12);

    expect(r.dataSource('manufacturer_datasheet')).toBeNull();
  });

  it('a box switched to passive radiator solves its blank radiator rather than skipping it', () => {
    const p = project();
    p.box.boxType.set('box-passive-radiator');
    // The switch gave the box a chart-ready radiator (`applyStartingValues`); blank it again,
    // since this test is about a radiator with nothing stated.
    p.box.passiveRadiator.radiator.spec.Sd_m2.clear();
    p.box.passiveRadiator.radiator.spec.Cms_m_per_N.clear();
    p.box.passiveRadiator.radiator.spec.Mms_kg.clear();
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    expect(p.box.passiveRadiator.systemTuning_hz.value).toBe(null);
    expect(p.box.passiveRadiator.systemTuning_hz.dq.length).toBeGreaterThan(0);
  });

  it('brand/model metadata is never solver-derived — setCalculated()/setDq() are no-ops, as for a radiator T/S spec', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.configurePR(library);

    expect(p.box.passiveRadiator.radiator.brand.value).toBe('SB Acoustics');
    expect(p.box.passiveRadiator.radiator.brand.entered).toBe(true);
    expect(p.box.passiveRadiator.radiator.brand.dq).toEqual([]);
    // A radiator's brand is a catalogue fact: no solver write exists on it.
    expect('setCalculated' in p.box.passiveRadiator.radiator.brand).toBe(false);
    expect('setDq' in p.box.passiveRadiator.radiator.brand).toBe(false);

    expect('clear' in p.box.passiveRadiator.radiator.brand).toBe(false);
    p.box.passiveRadiator.radiator.brand.set('');
    expect(p.box.passiveRadiator.radiator.brand.value).toBe('');
  });

  it('copies the chosen radiator IN, so later edits do not touch the library entry', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);

    expect(p.box.passiveRadiator.radiator.brand.value).toBe('SB Acoustics');

    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.031);
    expect(p.box.passiveRadiator.radiator.spec.Sd_m2.value).toBe(0.031);
    expect(library.spec.Sd_m2.value).toBe(0.025);
  });

  it('a radiator T/S field takes a calculated value: setCalculated() stores it as calculated, not entered', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);

    const Fs = p.box.passiveRadiator.radiator.spec.Fs_hz;
    Fs.clear();
    Fs.setCalculated(99);
    expect(Fs.value).toBe(99);
    expect(Fs.calculated).toBe(true);
    expect(Fs.entered).toBe(false);
  });

  it('detaches the box radiator into a standalone the library can hold, sharing no storage', () => {
    const p = new ProjectBuilder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), createEngine()).sealed().volume_m3(0.03).build();
    const chosen = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(chosen)) throw new Error(`fixture radiator is invalid: ${chosen.join(', ')}`);
    p.box.passiveRadiator.configurePR(chosen);
    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.031);

    const saved = p.box.passiveRadiator.radiator.detach();

    expect(saved.brand.value).toBe('SB Acoustics');
    expect(saved.spec.Sd_m2.value).toBe(0.031);

    // Storage is not shared in either direction.
    p.box.passiveRadiator.radiator.spec.Sd_m2.set(0.099);
    expect(saved.spec.Sd_m2.value).toBe(0.031);
    saved.spec.Sd_m2.set(0.011);
    expect(p.box.passiveRadiator.radiator.spec.Sd_m2.value).toBe(0.099);
  });

  it('detaches the blank radiator a box starts with', () => {
    const p = new ProjectBuilder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), createEngine()).sealed().volume_m3(0.03).build();

    expect(p.box.passiveRadiator.radiator.detach().brand.value).toBe('');
  });

  it('the blank radiator a box starts with has its own identity', () => {
    const p = new ProjectBuilder(driverFrom({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    }), createEngine()).sealed().volume_m3(0.03).build();

    expect(p.box.passiveRadiator.radiator.uuid()).toMatch(/\S/);
  });

  it('reports a driver-shaped record as no radiator, instead of throwing, so a picker can show it', () => {
    const driverShaped = driverJson({
      brand: 'Dayton', model: 'RS225', section: 'woofer',
      spec: specSection({ Fs_hz: 30, Qts: 0.4, Sd_m2: 0.02, Cms_m_per_N: 0.0005, Mmd_kg: 0.05, Rms_Ns_per_m: 2, Xmax_m: 0.008 }),
    });

    const result = OpenISDPassiveRadiatorStandalone.fromConformingRecord(driverShaped);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain('no passive-radiator section — this record is a driver, not a radiator');
  });

  it('a radiator states its record identity, the way a driver does — the bundled index and favourites key on it', () => {
    const blank = OpenISDPassiveRadiatorStandalone.empty();
    expect(blank.uuid()).toBe(blank.clonePassiveRadiator().uuid.value);
    expect(blank.uuid()).toMatch(/^[0-9a-f-]{36}$/);

    const p = project();
    p.box.passiveRadiator.configurePR(blank);
    expect(p.box.passiveRadiator.radiator.uuid()).toBe(blank.uuid());
  });

  it('a radiator answers its catalogue links by role, the way a driver does — null when the record carries none', () => {
    const blank = OpenISDPassiveRadiatorStandalone.empty();
    expect(blank.dataSource('manufacturer_datasheet')).toBeNull();
    expect(blank.dataSource('manufacturer_product_page')).toBeNull();
    expect(blank.dataSource('manufacturer_listing_page')).toBeNull();

    const json = blank.clonePassiveRadiator();
    json.data_sources = { value: { manufacturer_product_page: 'https://example.test/pr' } };
    const withLink = OpenISDPassiveRadiatorStandalone.wrap(json);
    expect(withLink.dataSource('manufacturer_product_page')).toBe('https://example.test/pr');
    expect(withLink.dataSource('manufacturer_datasheet')).toBeNull();
  });

  it('stamps added/providedBy the same way a blank driver does', () => {
    const appContext = fixedAppContext('id', '2026-03-04T00:00:00.000Z', 'johnl');
    const blank = OpenISDPassiveRadiatorStandalone.empty(appContext);

    expect(blank.added.value).toBe('20260304');
    expect(blank.providedBy.value).toBe('johnl');
  });

  it('makes a blank radiator an editor can fill in, and a box can adopt', () => {
    const blank = OpenISDPassiveRadiatorStandalone.empty();

    expect(blank.model.value).toBe('');
    expect(blank.spec.Fs_hz.value).toBe(null);

    const p = project();
    p.box.passiveRadiator.configurePR(blank);
    p.box.passiveRadiator.radiator.spec.Fs_hz.set(12);

    expect(p.box.passiveRadiator.radiator.spec.Fs_hz.value).toBe(12);
  });

  it('addedMassForTuning_kg answers not-available before a radiator is chosen — nothing to solve from', () => {
    const p = project();
    expect(p.box.passiveRadiator.addedMassForTuning_kg(15).value).toBe(null);
    expect(p.box.passiveRadiator.addedMassForTuning_kg(15).value).toBeNull();
  });

  // Regression for bugs/archive/BUG_20261003*.md
  it('naturalTuning_hz is the radiator tuning with no added mass and follows a hand edit of Fs; addedMassForTuning_kg follows it too', () => {
    const p = project();
    p.box.passiveRadiator.configurePR(radiatorFromSpec(createEngine(), {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095}));
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);
    const spec = p.box.passiveRadiator.radiator.spec;
    // With no added mass, the tuning the box produces (systemTuning_hz) is the radiator's natural tuning.
    expect(p.box.passiveRadiator.naturalTuning_hz.value).toBeCloseTo(p.box.passiveRadiator.systemTuning_hz.value!, 9);
    const massBefore = p.box.passiveRadiator.addedMassForTuning_kg(15).value;
    const naturalBefore = p.box.passiveRadiator.naturalTuning_hz.value;
    spec.Fs_hz.set(20);
    expect(p.box.passiveRadiator.naturalTuning_hz.value).toBeCloseTo(p.box.passiveRadiator.systemTuning_hz.value!, 9);
    expect(p.box.passiveRadiator.naturalTuning_hz.value).not.toBe(naturalBefore);
    expect(p.box.passiveRadiator.addedMassForTuning_kg(15).value).not.toBe(massBefore);
  });

  it('answers the mass to ADD for a target tuning, not the total moving mass', () => {
    // BUG_20260908_addedMassForTuning_returns_total_mass_not_added_mass: the engine's
    // `prMassForFp` inverts `prTuning`, whose input is (Mmd + Madd) — so it returns the TOTAL.
    // What the user must put ON the cone is that total less the radiator's own moving mass.
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    // The fixture project is sealed-built, so the PR box's own volume starts at 0 and every
    // passive-radiator calculation reports null until it is set. `systemTuning_hz` is an output
    // the project cascade only solves for the ACTIVE box type (S2-7d2).
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const added = p.box.passiveRadiator.addedMassForTuning_kg(15);

    // Applying the answer must actually produce the target — the property that makes it the
    // right quantity, checked through the box's own forward calculation rather than a literal.
    p.box.passiveRadiator.addedMass_kg.set(added.value!);
    expect(p.box.passiveRadiator.systemTuning_hz.value).toBeCloseTo(15, 6);
  });

  it('reports impossible calculated mass for an unreachable tuning target and shows dq on the related fields', () => {
    // The highest tuning reachable is the one produced with NO added mass; above that the
    // arithmetic asks for negative mass, and mass cannot come off a cone carrying none.
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;

    expect(p.box.passiveRadiator.addedMassForTuning_kg(ceiling * 1.5).value).toBeLessThan(0);
    // At the ceiling itself the answer is zero added mass, not null — reachable, just barely.
    expect(p.box.passiveRadiator.addedMassForTuning_kg(ceiling).value).toBeCloseTo(0, 9);

    p.box.passiveRadiator.tuning_goal_hz.set(ceiling * 1.5);
    p.notifyPrChanged();

    expect(p.box.passiveRadiator.addedMass_kg.value).toBeNull();
    expect(p.box.passiveRadiator.addedMass_kg.dq.some(issue => issue.kind === 'target-unreachable')).toBe(true);

    p.box.passiveRadiator.tuning_goal_hz.set(ceiling);
    p.notifyPrChanged();

    expect(p.box.passiveRadiator.addedMass_kg.value).toBeCloseTo(0, 9);
    expect(p.box.passiveRadiator.addedMass_kg.dq.some(issue => issue.kind === 'target-unreachable')).toBe(false);
  });

  it('carries the dq on EVERY passive-radiator input and output when the target is unreachable', () => {
    // The unreachable-target DQ is not a property of the bad calculated mass alone — the user
    // sees the ⚠ on the target they typed AND on every derived output, so the field that is the
    // real problem (the entered tuning) and the fields that merely show its consequence all flag.
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.volume_m3.set(0.03);
    p.box.passiveRadiator.addedMass_kg.set(0);

    const ceiling = p.box.passiveRadiator.systemTuning_hz.value!;
    p.box.passiveRadiator.tuning_goal_hz.set(ceiling * 1.5);
    p.notifyPrChanged();

    const DQ = [fixtureEngine.issues.targetUnreachable('addedMass_kg', ceiling)];
    expect(p.box.passiveRadiator.tuning_goal_hz.entered).toBe(true);                 // the input
    expect(p.box.passiveRadiator.tuning_goal_hz.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.addedMass_kg.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.systemTuning_hz.dq).toEqual(DQ);
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.dq).toEqual(DQ);
  });

  it('reports no resonance-with-added-mass until a radiator is chosen', () => {
    expect(project().box.passiveRadiator.resonanceWithAddedMass_hz.value).toBeNull();
  });

  it('resonates at the radiator own Fs when no mass has been added', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.addedMass_kg.set(0);

    // Mms 0.09 kg on Cms 0.0009 m/N: 1/(2π·√(0.09·0.0009)) = 17.6838… Hz.
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.value).toBeCloseTo(17.6838, 3);
  });

  it('falls as tuning mass goes onto the cone', () => {
    const p = project();
    const library = OpenISDPassiveRadiatorStandalone.fromConformingRecord(prJson());
    if (Array.isArray(library)) throw new Error(`fixture radiator is invalid: ${library.join(', ')}`);
    p.box.passiveRadiator.radiator.update(library);
    p.box.boxType.set('box-passive-radiator');
    p.box.passiveRadiator.addedMass_kg.set(0.111111);

    // (0.09 + 0.111111) kg on the same compliance: 1/(2π·√(0.201111·0.0009)) = 11.8298… Hz.
    expect(p.box.passiveRadiator.resonanceWithAddedMass_hz.value).toBeCloseTo(11.8299, 3);
  });
});
