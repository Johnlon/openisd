/**
 * `OpenISDProject`'s box/vent/PR field accessors (`@openisd/design`) — every caller (the UI,
 * the vent/PR solvers, `toUiParams()`/`loadUiParams()`) reads and writes box/vent/PR fields
 * through the project's own `box` surface, direct to the domain object.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { OpenISDProject, OpenISDDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';

function blankDriverRecord(): unknown {
  const bookkeeping = { value: '' };
  return {
    uuid: { value: crypto.randomUUID() },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    manufacturer: { value: '' }, brand: { value: '' }, model: { value: '' },
    sku: { value: '', grounds: [{ origin: 'entered', reading: '' }] },
    driver_type: { value: '' },
    data_sources: bookkeeping,
    authoritative: bookkeeping,
    specs: {},
  };
}

function ventedProject() {
  const engine = new Engine();
  const driver = OpenISDDriver.fromConformingRecord(blankDriverRecord(), engine);
  if (Array.isArray(driver)) throw new Error(`blankDriverRecord() does not conform: ${driver.join('; ')}`);
  return OpenISDProject.builder(driver, engine).vented().volume_m3(0.03).tuning_hz(30).build();
}

function sealedProject() {
  const engine = new Engine();
  const driver = OpenISDDriver.fromConformingRecord(blankDriverRecord(), engine);
  if (Array.isArray(driver)) throw new Error(`blankDriverRecord() does not conform: ${driver.join('; ')}`);
  return OpenISDProject.builder(driver, engine).sealed().volume_m3(0.02).build();
}

describe('OpenISDProject — box field read/write', () => {
  it('box.vented.volume_m3 reads and writes when vented is active', () => {
    const p = ventedProject();
    p.box.vented.volume_m3.set(0.045);
    assert.equal(p.box.vented.volume_m3.get().value, 0.045);
  });

  it('box.vented.tuning_hz reads and writes when vented is active', () => {
    const p = ventedProject();
    p.box.vented.tuning_hz.set(31);
    assert.equal(p.box.vented.tuning_hz.get().value, 31);
  });

  it('box.vented.vent.diameter_m reads/writes the diameter of the active vent', () => {
    const p = ventedProject();
    p.box.vented.vent.diameter_m.set(0.08);
    assert.equal(p.box.vented.vent.diameter_m.get().value, 0.08);
  });

  it('a box-field write notifies subscribers', () => {
    const p = ventedProject();
    let notified = 0;
    p.subscribe(() => notified++);
    p.box.vented.volume_m3.set(0.05);
    assert.ok(notified > 0, 'a project mutation must notify subscribers');
  });
});

describe('OpenISDProject — bandpass4 front chamber (Vf)', () => {
  it('bandpass4.chambers.front.volume_m3 is reachable regardless of active box type', () => {
    const p = sealedProject();   // Vf must stay reachable while dormant
    p.box.bandpass4.chambers.front.volume_m3.set(0.017);
    assert.equal(p.box.bandpass4.chambers.front.volume_m3.get(), 0.017);
  });
});

describe('OpenISDProject — passive radiator field read/write', () => {
  it('passiveRadiator.radiator.spec reads not-available with no radiator chosen, and never creates one on read', () => {
    const p = sealedProject();
    assert.equal(p.box.passiveRadiator.radiator.spec.Sd_m2.get().value, null);
  });

  it('passiveRadiator.count and addedMass_kg live on the box, settable with no radiator chosen', () => {
    const p = sealedProject();
    p.box.passiveRadiator.count.set(2);
    p.box.passiveRadiator.addedMass_kg.set(0.011);
    assert.equal(p.box.passiveRadiator.count.get(), 2);
    assert.equal(p.box.passiveRadiator.addedMass_kg.get().value, 0.011);
  });
});
