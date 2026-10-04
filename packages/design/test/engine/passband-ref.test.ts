import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/index.js';

/** The engine's one door: every calculation below is a method on this object. */
const engine = createEngine();

describe('passbandRef', () => {
  describe('passbandRef — one definition of the passband reference level', () => {
    it('ignores the -200 dB "no output" sentinel', () => {
      assert.equal(engine.simulation.passbandRef([-200, 80, 90, 85, -200]), 90);
    });
    it('returns 0 for an all-sentinel curve rather than -200', () => {
      assert.equal(engine.simulation.passbandRef([-200, -200]), 0);
    });
  });
});
