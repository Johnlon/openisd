/**
 * Clearing the entered side of the tuning / vent-length pair is the field's own behaviour.
 * The partner keeps its value as E and the cleared side is calculated from it (John, 2026-10-16).
 * Where the partner holds no value both go to N: no starting alignment is written (John, 2026-10-16).
 * Clearing the calculated side changes nothing (John, 2026-10-06).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {createEngine} from '../../engine/Engine.js';

function ventedProject() {
  const p = ProjectBuilder.empty(createEngine());
  p.driver.specs.Fs_hz.set(40);
  p.driver.specs.Qts.set(0.38);
  p.driver.specs.Qes.set(0.45);
  p.driver.specs.Vas_m3.set(0.03);
  p.box.boxType.set('vented');
  p.box.vented.vent.shape.set('round');
  p.box.vented.vent.diameter_m.set(0.05);
  p.box.vented.vent.endCorrection_m.set(0.6);
  return p;
}

describe('vent pair clear (domain cells)', () => {
  it('clearing an entered tuning whose partner has no value leaves both N: no starting alignment, volume untouched', () => {
    const p = ventedProject();
    p.box.vented.tuning_goal_hz.set(77.777);
    p.box.vented.volume_m3.set(0.123456);
    p.box.vented.tuning_goal_hz.clear();
    assert.equal(p.box.vented.tuning_goal_hz.value, null);
    assert.equal(p.box.vented.vent.length_m.value, null);
    assert.equal(p.box.vented.volume_m3.value, 0.123456);
  });

  it('clearing an entered length keeps the tuning at its value, entered; the length is calculated', () => {
    const p = ventedProject();
    p.box.vented.vent.length_m.set(0.222222);
    const fb = p.box.vented.tuning_goal_hz.value;
    p.box.vented.vent.length_m.clear();
    assert.equal(p.box.vented.tuning_goal_hz.value, fb);
    assert.equal(p.box.vented.tuning_goal_hz.entered, true);
    assert.equal(p.box.vented.vent.length_m.calculated, true);
  });

  it('clearing the calculated side changes nothing', () => {
    const p = ventedProject();
    p.box.vented.vent.length_m.set(0.222222);
    p.box.vented.tuning_goal_hz.clear();
    assert.equal(p.box.vented.vent.length_m.value, 0.222222);
    assert.equal(p.box.vented.vent.length_m.entered, true);
  });

  // The starting tuning is shown to the decimals the Box tab displays, not to every digit the
  // design solve produced.
  it('the starting alignment states Fb to 0.01 Hz', () => {
    const p = ventedProject();
    p.box.resetVentedAlignment();
    assert.equal(p.box.vented.tuning_goal_hz.precision, 0.005);
  });

  it('a built vented project states its starting Fb to 0.01 Hz too', () => {
    const p = ventedProject();
    p.box.boxType.set('sealed');
    p.box.boxType.set('vented');
    assert.equal(p.box.vented.tuning_goal_hz.precision, 0.005);
  });
});
