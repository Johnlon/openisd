/**
 * Clearing the entered side of the tuning / vent-length pair is the field's own behaviour
 * (John, 2026-10-01: a cleared pair must not stay blank — "unrecoverable" — so the vented box
 * falls back to the starting alignment a fresh box gets; a bandpass front chamber has none).
 * Clearing the calculated side changes nothing (John, 2026-10-06).
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {ProjectBuilder} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';

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

function startingAlignment() {
  const ref = ventedProject();
  ref.box.resetVentedAlignment();
  return {Vb: ref.box.vented.volume_m3.value, Fb: ref.box.vented.tuning_goal_hz.value};
}

describe('vent pair clear (domain cells)', () => {
  it('clearing an entered tuning falls back to the starting alignment, entered', () => {
    const want = startingAlignment();
    const p = ventedProject();
    p.box.vented.tuning_goal_hz.set(77.777);
    p.box.vented.volume_m3.set(0.123456);
    p.box.vented.tuning_goal_hz.clear();
    assert.equal(p.box.vented.tuning_goal_hz.value, want.Fb);
    assert.equal(p.box.vented.volume_m3.value, want.Vb);
    assert.equal(p.box.vented.tuning_goal_hz.entered, true);
    assert.equal(p.box.vented.vent.length_m.calculated, true);
  });

  it('clearing an entered length falls back the same way', () => {
    const want = startingAlignment();
    const p = ventedProject();
    p.box.vented.vent.length_m.set(0.222222);
    p.box.vented.vent.length_m.clear();
    assert.equal(p.box.vented.tuning_goal_hz.value, want.Fb);
    assert.equal(p.box.vented.tuning_goal_hz.entered, true);
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
    p.box.vented.tuning_goal_hz.clear();
    p.box.boxType.set('vented');
    assert.equal(p.box.vented.tuning_goal_hz.precision, 0.005);
  });
});
