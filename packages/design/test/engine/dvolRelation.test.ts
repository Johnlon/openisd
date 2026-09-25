import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {solveConsistencyGroup} from './testSolver.js';

/**
 * The DVol/Depth/MagDepth/Magnet geometry lock (dvolRelation.ts, wired into
 * solveConsistencyGroup at solver.ts's block 9b). Each of the four directions refuses
 * (leaves its target un-derived) rather than returning a nonsensical value when the other
 * four participants describe a degenerate geometry — never reachable directly (the engine's
 * one door forbids importing dvolRelation.ts outside solver.ts), so each guard is driven
 * here through the real consistency solve.
 */
describe('DVol geometry lock — degenerate-geometry guards refuse rather than invent a value', () => {
  const Dd_m = 0.15, Vcd_m = 0.025; // S = Dd² + Dd·Vcd + Vcd² ≈ 0.026875

  it('dvolFromDims: a non-positive participant (Magnet_m = 0) leaves DVol_m3 un-derived', () => {
    const out = solveConsistencyGroup({Dd_m, Vcd_m, Depth_m: 0.06, MagDepth_m: 0.02, Magnet_m: 0});
    assert.equal(out.DVol_m3, undefined);
  });

  it('depthFromDims: a non-positive DVol_m3 leaves Depth_m un-derived', () => {
    const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0, MagDepth_m: 0.02, Magnet_m: 0.08});
    assert.equal(out.Depth_m, undefined);
  });

  it('magDepthFromDims: a non-positive DVol_m3 leaves MagDepth_m un-derived', () => {
    const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0, Depth_m: 0.06, Magnet_m: 0.08});
    assert.equal(out.MagDepth_m, undefined);
  });

  it('magDepthFromDims: a Magnet_m too large for S (S − 3·Magnet² ≤ 0) leaves MagDepth_m un-derived', () => {
    const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0.0001, Depth_m: 0.06, Magnet_m: 0.15});
    assert.equal(out.MagDepth_m, undefined);
  });

  it('magnetFromDims: a non-positive Depth_m leaves Magnet_m un-derived', () => {
    const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0.0001, Depth_m: 0, MagDepth_m: 0.02});
    assert.equal(out.Magnet_m, undefined);
  });

  it('magnetFromDims: a radicand that goes negative (DVol far too small for the cone) leaves Magnet_m un-derived', () => {
    const out = solveConsistencyGroup({Dd_m, Vcd_m, DVol_m3: 0.00001, Depth_m: 0.06, MagDepth_m: 0.02});
    assert.equal(out.Magnet_m, undefined);
  });
});
