import {describe, expect, it} from 'vitest';
import {Engine} from '../../engine/index.js';

const engine = new Engine();

// Two genuinely different air conditions — reference (20 °C) vs. a hot, humid one — so any
// function reading `air` must give a DIFFERENT answer for the two, and the reference case must
// match what the function gave before it took `air` explicitly (regression safety).
const REFERENCE_AIR = engine.solveEnvironment({}).values;
const HOT_AIR = engine.solveEnvironment({ tempK: 313.15, humidityPct: 90, pressurePa: 95000 }).values;

describe('boxDesign air-sensitivity — ventLength/tuningFromLength/prTuning/prMassForFp', () => {
  it('ventLength gives a different length at a non-reference air pair', () => {
    const atReference = engine.ventLength(0.03, 35, 0.002, 1, REFERENCE_AIR);
    const atHot = engine.ventLength(0.03, 35, 0.002, 1, HOT_AIR);
    expect(atHot).not.toBeCloseTo(atReference, 6);
  });

  it('tuningFromLength gives a different tuning at a non-reference air pair', () => {
    const atReference = engine.tuningFromLength(0.03, 0.1, 0.002, 1, REFERENCE_AIR);
    const atHot = engine.tuningFromLength(0.03, 0.1, 0.002, 1, HOT_AIR);
    expect(atHot).not.toBeCloseTo(atReference, 6);
  });

  it('prTuning gives a different tuning at a non-reference air pair', () => {
    const P = { Vb: 0.03, prMmd: 0.02, prMadd: 0, prSd: 0.02, prCms: 0.0008 };
    const atReference = engine.prTuning(P, REFERENCE_AIR);
    const atHot = engine.prTuning(P, HOT_AIR);
    expect(atHot).not.toBeCloseTo(atReference, 6);
  });

  it('prMassForFp gives a different mass at a non-reference air pair', () => {
    const P = { Vb: 0.03, prMmd: 0.02, prMadd: 0, prSd: 0.02, prCms: 0.0008 };
    const atReference = engine.prMassForFp(P, 30, REFERENCE_AIR);
    const atHot = engine.prMassForFp(P, 30, HOT_AIR);
    expect(atHot).not.toBeCloseTo(atReference, 6);
  });

  it('ventLength and tuningFromLength still round-trip at a fixed, explicit air pair', () => {
    const L = engine.ventLength(0.03, 35, 0.002, 1, HOT_AIR);
    const back = engine.tuningFromLength(0.03, L, 0.002, 1, HOT_AIR);
    expect(back).toBeCloseTo(35, 6);
  });
});
