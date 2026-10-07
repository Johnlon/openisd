/**
 * A new 6th-order bandpass or ABC project starts with the values WinISD's wizard gives one
 * (capture winisd_research/runs/bp6_abc_wizard_defaults/, plan PLAN_20261007_bp6_abc_complete.md
 * step 1): rear 0.03 m³ at 35 Hz, front 0.02 m³ at 25 Hz, round vents 0.102 m across; the ABC
 * connecting vent 0.050 m long.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, ProjectBuilder} from '../../domain/index.js';
import {createEngine} from '../../engine/index.js';

function built(type: 'bandpass6' | 'abc') {
  const engine = createEngine();
  const builder = new ProjectBuilder(OpenISDDriver.empty(engine), engine);
  return type === 'bandpass6' ? builder.bandpass6().build() : builder.abc().build();
}

describe('bandpass6 and ABC starting values', () => {
  for (const type of ['bandpass6', 'abc'] as const) {
    it(`${type}: chambers, tunings and vent sizes are stated`, () => {
      const p = built(type);
      const chambers = type === 'bandpass6' ? p.box.bandpass6.chambers : p.box.abc.chambers;
      const vents = type === 'bandpass6' ? p.box.bandpass6.vents : p.box.abc.vents;
      assert.equal(chambers.rear.volume_m3.value, 0.03);
      assert.equal(chambers.rear.tuning_goal_hz.value, 35);
      assert.equal(chambers.front.volume_m3.value, 0.02);
      assert.equal(chambers.front.tuning_goal_hz.value, 25);
      assert.equal(vents.rear.diameter_m.value, 0.102);
      assert.equal(vents.front.diameter_m.value, 0.102);
    });
  }

  it('abc: the connecting vent is 0.102 m across and 0.050 m long', () => {
    const p = built('abc');
    assert.equal(p.box.abc.vents.intra.diameter_m.value, 0.102);
    assert.equal(p.box.abc.vents.intra.length_m.value, 0.05);
  });

  it('values already entered are not overwritten', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(OpenISDDriver.empty(engine), engine).bandpass6()
      .rearVolume_m3(0.111111).frontVolume_m3(0.222222).rearTuning_hz(33.3333).frontTuning_hz(44.4444).build();
    assert.equal(p.box.bandpass6.chambers.rear.volume_m3.value, 0.111111);
    assert.equal(p.box.bandpass6.chambers.front.volume_m3.value, 0.222222);
    assert.equal(p.box.bandpass6.chambers.rear.tuning_goal_hz.value, 33.3333);
    assert.equal(p.box.bandpass6.chambers.front.tuning_goal_hz.value, 44.4444);
  });
});
