/**
 * BUG_20260918_bandpass4-front-chamber-tuning-writes-vented-cell: on a 4th-order bandpass the
 * vent group (Vf, ventD, Ffc, ventL) is the FRONT chamber's. The UI seam wrote `box.vented.*`
 * for every box type, a cell the bandpass solve never reads, so the front vent length never
 * solved and a typed diameter did not stick.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {
  clearVentField as clearVentFieldOn,
  enterVentField as enterVentFieldOn,
  ventFieldState as ventFieldStateOn,
} from '../../src/logic/useVentGroup.js';

function bandpass4Project() {
  const engine = createEngine();
  const driver = OpenISDDriver.empty(engine);
  const p = new ProjectBuilder(driver, engine).bandpass4().rearVolume_m3(0.03).frontVolume_m3(0.02)
    .frontTuning_hz(40).build();
  p.box.bandpass4.vents.front.shape.set('round');
  p.box.bandpass4.vents.front.endCorrection_m.set(0.6);
  return p;
}

describe('vent group on a 4th-order bandpass writes the front chamber', () => {
  it('entering Fb sets the front chamber tuning and leaves the vented box alone', () => {
    const p = bandpass4Project();
    const ventedBefore = p.box.vented.tuning_goal_hz.value;
    enterVentFieldOn(p, 'Fb', 47.8);
    assert.equal(p.box.bandpass4.chambers.front.tuning_goal_hz.value, 47.8);
    assert.equal(p.box.vented.tuning_goal_hz.value, ventedBefore);
  });

  it('entering a diameter sets the front vent, and the front length then solves', () => {
    const p = bandpass4Project();
    enterVentFieldOn(p, 'Fb', 47.8);
    enterVentFieldOn(p, 'ventD', 0.05);
    assert.equal(p.box.bandpass4.vents.front.diameter_m.value, 0.05);
    const length = p.box.bandpass4.vents.front.length_m.value;
    assert.ok(length !== null && length > 0, `front vent length solved, got ${length}`);
    assert.equal(ventFieldStateOn(p, 'Fb'), 'E');
    assert.equal(ventFieldStateOn(p, 'ventL'), 'C');
  });

  it('clearing Fb clears the front chamber tuning', () => {
    const p = bandpass4Project();
    enterVentFieldOn(p, 'ventD', 0.05);
    enterVentFieldOn(p, 'ventL', 0.15);
    clearVentFieldOn(p, 'Fb');
    assert.equal(ventFieldStateOn(p, 'Fb'), 'C');
  });
});
