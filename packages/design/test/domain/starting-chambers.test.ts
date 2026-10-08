/**
 * `startingChambersOf` is the one source of a dual-chamber box's starting chambers; a project built
 * for the type (which runs `applyStartingValues`) must carry exactly those values.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {OpenISDDriver, ProjectBuilder} from '../../domain/index.js';
import {startingChambersOf, takesChamberTunings} from '../../domain/box/startingChambers.js';
import {createEngine} from '../../engine/index.js';

function builder() {
  const engine = createEngine();
  return new ProjectBuilder(OpenISDDriver.empty(engine), engine);
}

describe('startingChambersOf', () => {
  it('bandpass4: 7 L rear (sealed, no tuning), 10 L front at 35 Hz', () => {
    assert.deepEqual(startingChambersOf('bandpass4'),
      {rearVolume_m3: 0.007, frontVolume_m3: 0.01, rearTuning_hz: null, frontTuning_hz: 35});
  });
  for (const type of ['bandpass6', 'abc'] as const) {
    it(`${type}: 30 L rear at 35 Hz, 20 L front at 25 Hz`, () => {
      assert.deepEqual(startingChambersOf(type),
        {rearVolume_m3: 0.03, frontVolume_m3: 0.02, rearTuning_hz: 35, frontTuning_hz: 25});
    });
  }
});

describe('a built project carries startingChambersOf', () => {
  it('bandpass4', () => {
    const want = startingChambersOf('bandpass4');
    const c = builder().bandpass4().build().box.bandpass4.chambers;
    assert.equal(c.rear.volume_m3.value, want.rearVolume_m3);
    assert.equal(c.front.volume_m3.value, want.frontVolume_m3);
    assert.equal(c.front.tuning_goal_hz.value, want.frontTuning_hz);
  });
  for (const type of ['bandpass6', 'abc'] as const) {
    it(type, () => {
      const want = startingChambersOf(type);
      const p = type === 'bandpass6' ? builder().bandpass6().build() : builder().abc().build();
      const c = type === 'bandpass6' ? p.box.bandpass6.chambers : p.box.abc.chambers;
      assert.equal(c.rear.volume_m3.value, want.rearVolume_m3);
      assert.equal(c.front.volume_m3.value, want.frontVolume_m3);
      assert.equal(c.rear.tuning_goal_hz.value, want.rearTuning_hz);
      assert.equal(c.front.tuning_goal_hz.value, want.frontTuning_hz);
    });
  }
});

describe('takesChamberTunings', () => {
  it('is true for bandpass6 and abc only', () => {
    for (const t of ['bandpass6', 'abc'] as const) assert.equal(takesChamberTunings(t), true);
    for (const t of ['sealed', 'vented', 'box-passive-radiator', 'bandpass4'] as const) assert.equal(takesChamberTunings(t), false);
  });
});
