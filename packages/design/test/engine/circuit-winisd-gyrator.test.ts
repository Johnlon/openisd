import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';
import type {SweepParams} from '../../engine/types.js';
import {REFERENCE_AIR} from '../fixtures/referenceAir.js';
import {sweepDriver} from './testSolver.js';

const engine = createEngine();
const LE_H = 0.7e-3;
const P: SweepParams = {Vb: 0.03, eg: 2.83, fmin: 100, fmax: 20000, N: 20, air: REFERENCE_AIR};

describe('circuit model winisdGyrator', () => {
  it('equals the gyrator model when the driver states no Qes, so there is no second BL to disagree with', () => {
    const noQes = sweepDriver({
      Fs_hz: 37, Vas_m3: 0.03, Sd_m2: 0.0133, Re_ohm: 5.6, Re_terminal_ohm: 5.6, Qms: 7, BL_Tm: 7, BL_terminal_Tm: 7,
    });
    const winisdGyrator = engine.simulation.sweep(noQes, LE_H, 'sealed', {...P, circuitModel: 'winisdGyrator'}).values!;
    const gyrator = engine.simulation.sweep(noQes, LE_H, 'sealed', {...P, circuitModel: 'gyrator'}).values!;
    expect(winisdGyrator.spl).toEqual(gyrator.spl);
    expect(winisdGyrator.zmag).toEqual(gyrator.zmag);
  });
});
