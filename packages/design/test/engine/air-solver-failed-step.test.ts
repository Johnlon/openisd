/**
 * T930 (ultra review finding 10): the air solver's propagation stopped at the first relation that
 * returned a step, even a failed one. With pressure and humidity typed and a very low sound velocity
 * typed (below about 119 m/s at 1 atm) the density step fails (no density that low is in range) and
 * the sound-velocity relation, which would solve the temperature, was never tried: T stayed at the
 * app's 293.15 K and a false "disagree by 68%" issue showed. A failed step must go on to the next
 * relation.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '../../engine/Engine.js';
import type {AirInput, AirInputs} from '../../engine/environment/airSolver.js';

const engine = createEngine();
const entered = (value: number, precision = 0.5): AirInput => ({kind: 'entered', value, precision});
const open: AirInput = {kind: 'open'};
const inputs = (partial: Partial<AirInputs>): AirInputs =>
  ({tempK: open, humidityPct: open, pressurePa: open, c: open, rho: open, ...partial});

describe('air solver: a failed step goes on to the next relation (T930)', () => {
  it('p 101325, RH 50 and c 110 typed: the temperature is solved from c, and no disagreement is reported', () => {
    const r = engine.environment.solveAir(inputs({pressurePa: entered(101325), humidityPct: entered(50), c: entered(110)}));
    assert.ok(Math.abs(r.values.tempK - 30.1) < 0.5, `T was ${r.values.tempK}, expected about 30.1 K`);
    assert.ok(!r.issues.some(i => JSON.stringify(i).includes('disagree')), JSON.stringify(r.issues));
  });

  it('p 101325, RH 50 and c 330 typed (a normal case): T is 270.7 K as before', () => {
    const r = engine.environment.solveAir(inputs({pressurePa: entered(101325), humidityPct: entered(50), c: entered(330)}));
    assert.ok(Math.abs(r.values.tempK - 270.7) < 0.1, `T was ${r.values.tempK}`);
  });
});
