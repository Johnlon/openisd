/**
 * THE ORDER ENTERED VALUES ARE WRITTEN DOES NOT CHANGE THE SOLVE.
 *
 * Same entered vented box — 7 L, 35 Hz target, round 5 cm vent, end correction 0.6, same driver —
 * reached two ways: the tuning written before the vent diameter, and after it. Whatever the
 * project derives from them (vent length, tuning, the swept curves) must be bit-identical.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, ProjectBuilder, type OpenISDProject} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';

function blankDriverRecord(): unknown {
  return {
    uuid: {value: crypto.randomUUID()},
    quality: {confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []},
    manufacturer: {value: ''}, brand: {value: ''}, model: {value: ''},
    sku: {value: '', grounds: [{origin: 'entered', reading: ''}]},
    driver_type: {value: 'woofer'},
    data_sources: {value: {}},
    specs: {woofer: {}},
  };
}

const VOLUME_M3 = 0.007;
const TUNING_HZ = 35;

function builder(): ProjectBuilder {
  const engine = createEngine();
  const driver = OpenISDDriver.fromConformingRecord(blankDriverRecord(), engine);
  if (Array.isArray(driver)) throw new Error(`blankDriverRecord() does not conform: ${driver.join('; ')}`);
  return new ProjectBuilder(driver, engine);
}

function tuningThenDiameter(): OpenISDProject {
  const p = builder().vented().volume_m3(VOLUME_M3).tuning_goal_hz(TUNING_HZ).build();
  p.box.vented.vent.shape.set('round');
  p.box.vented.vent.diameter_m.set(0.05);
  p.box.vented.vent.endCorrection_m.set(0.6);
  return p;
}

function diameterThenTuning(): OpenISDProject {
  const p = builder().vented().volume_m3(VOLUME_M3).build();
  p.box.vented.vent.shape.set('round');
  p.box.vented.vent.diameter_m.set(0.05);
  p.box.vented.vent.endCorrection_m.set(0.6);
  p.box.vented.tuning_goal_hz.set(TUNING_HZ);
  return p;
}

describe('project entry order — the same entered vented box solves the same', () => {
  it('solved vent length for the target tuning', () => {
    const a = tuningThenDiameter().box.vented.vent.lengthForTuning_m(VOLUME_M3, TUNING_HZ);
    const b = diameterThenTuning().box.vented.vent.lengthForTuning_m(VOLUME_M3, TUNING_HZ);
    assert.notEqual(a, null);
    assert.equal(a, b);
  });

  it('stored vent length', () => {
    assert.equal(tuningThenDiameter().box.vented.vent.length_m.value, diameterThenTuning().box.vented.vent.length_m.value);
  });
});
