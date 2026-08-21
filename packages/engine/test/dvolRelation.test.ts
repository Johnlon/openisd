/**
 * Unit tests for packages/engine/src/dvolRelation.ts — the DVol/Depth/MagDepth/Magnet geometry
 * relation, pinned in docs/design/WINISD_SCHEMA.md §3.10.1.
 *
 * A fixed geometry (arbitrary but physically plausible driver dimensions) anchors every test:
 * Dd 90mm, Vcd 25mm, Depth 55mm, MagDepth 20mm, Magnet 60mm. DVol is computed forward once and
 * reused everywhere, so "the four directions agree" is testing the SAME numbers throughout,
 * not four independently-plausible-looking values.
 */

import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { dvolFromDims, depthFromDims, magDepthFromDims, magnetFromDims } from '../src/dvolRelation.js';

const Dd = 0.090, Vcd = 0.025, Depth = 0.055, MagDepth = 0.020, Magnet = 0.060;
// S = Dd² + Dd·Vcd + Vcd² = 0.0081 + 0.00225 + 0.000625 = 0.010975
// DVol = (π/4)·[ S·(Depth−MagDepth)/3 + Magnet²·MagDepth ]
//      = (π/4)·[ 0.010975·0.035/3 + 0.0036·0.020 ]
//      = (π/4)·[ 0.000128041666… + 0.000072 ] = (π/4)·0.000200041666… = 1.5711235760296454e-4
const EXPECTED_DVOL = 1.5711235760296454e-4;

describe('dvolFromDims — the forward direction, formula pinned exactly', () => {
  it('matches the hand-derived value to 1e-12 relative', () => {
    const v = dvolFromDims({ Dd, Vcd, Depth, MagDepth, Magnet });
    assert.ok(v != null);
    assert.ok(Math.abs(v! - EXPECTED_DVOL) / EXPECTED_DVOL < 1e-12, `${v} vs ${EXPECTED_DVOL}`);
  });

  it('refuses when any input is zero or negative', () => {
    for (const bad of [{ Dd: 0 }, { Vcd: -1 }, { Depth: 0 }, { MagDepth: 0 }, { Magnet: 0 }]) {
      assert.equal(dvolFromDims({ Dd, Vcd, Depth, MagDepth, Magnet, ...bad }), null);
    }
  });

  it('refuses when Depth does not exceed MagDepth — a non-positive cone height', () => {
    assert.equal(dvolFromDims({ Dd, Vcd, Depth: 0.020, MagDepth: 0.020, Magnet }), null);
    assert.equal(dvolFromDims({ Dd, Vcd, Depth: 0.015, MagDepth: 0.020, Magnet }), null);
  });
});

describe('the three inverses recover the exact geometry that produced DVol', () => {
  it('depthFromDims recovers Depth', () => {
    const v = depthFromDims({ Dd, Vcd, DVol: EXPECTED_DVOL, MagDepth, Magnet });
    assert.ok(v != null);
    assert.ok(Math.abs(v! - Depth) / Depth < 1e-9, `${v} vs ${Depth}`);
  });

  it('magDepthFromDims recovers MagDepth', () => {
    const v = magDepthFromDims({ Dd, Vcd, DVol: EXPECTED_DVOL, Depth, Magnet });
    assert.ok(v != null);
    assert.ok(Math.abs(v! - MagDepth) / MagDepth < 1e-9, `${v} vs ${MagDepth}`);
  });

  it('magnetFromDims recovers Magnet', () => {
    const v = magnetFromDims({ Dd, Vcd, DVol: EXPECTED_DVOL, Depth, MagDepth });
    assert.ok(v != null);
    assert.ok(Math.abs(v! - Magnet) / Magnet < 1e-9, `${v} vs ${Magnet}`);
  });
});

describe('round-trip: forward then each inverse, across a spread of geometries', () => {
  // Magnet is bounded by the geometry itself (magDepthFromDims's own guard: S - 3*Magnet^2 > 0,
  // i.e. Magnet < sqrt(S/3)) — a magnet wider than that has no physical driver behind it for
  // this Dd/Vcd, so every geometry below picks one comfortably under its own ceiling.
  const geometries = [
    { Dd: 0.060, Vcd: 0.013, Depth: 0.035, MagDepth: 0.012, Magnet: 0.038 },  // ceiling 0.0429
    { Dd: 0.130, Vcd: 0.038, Depth: 0.080, MagDepth: 0.030, Magnet: 0.075 },  // ceiling 0.0881
    { Dd: 0.200, Vcd: 0.050, Depth: 0.100, MagDepth: 0.015, Magnet: 0.110 },  // ceiling 0.1323
  ];

  for (const g of geometries) {
    it(`Dd=${g.Dd} Vcd=${g.Vcd} Depth=${g.Depth} MagDepth=${g.MagDepth} Magnet=${g.Magnet}`, () => {
      const DVol = dvolFromDims(g);
      assert.ok(DVol != null, 'forward must succeed for a physically plausible geometry');

      const depth = depthFromDims({ Dd: g.Dd, Vcd: g.Vcd, DVol: DVol!, MagDepth: g.MagDepth, Magnet: g.Magnet });
      const magDepth = magDepthFromDims({ Dd: g.Dd, Vcd: g.Vcd, DVol: DVol!, Depth: g.Depth, Magnet: g.Magnet });
      const magnet = magnetFromDims({ Dd: g.Dd, Vcd: g.Vcd, DVol: DVol!, Depth: g.Depth, MagDepth: g.MagDepth });

      assert.ok(depth != null && magDepth != null && magnet != null, 'all three inverses must succeed');
      assert.ok(Math.abs(depth! - g.Depth) / g.Depth < 1e-9, `Depth: ${depth} vs ${g.Depth}`);
      assert.ok(Math.abs(magDepth! - g.MagDepth) / g.MagDepth < 1e-9, `MagDepth: ${magDepth} vs ${g.MagDepth}`);
      assert.ok(Math.abs(magnet! - g.Magnet) / g.Magnet < 1e-9, `Magnet: ${magnet} vs ${g.Magnet}`);
    });
  }
});

describe('magnetFromDims — refuses rather than returning NaN on an impossible input set', () => {
  it('refuses when the radicand would be negative (DVol too small for the cone alone)', () => {
    // A tiny DVol cannot fit even the cone's own contribution with this MagDepth/geometry.
    const v = magnetFromDims({ Dd, Vcd, DVol: 1e-9, Depth, MagDepth });
    assert.equal(v, null);
  });
});

describe('magDepthFromDims — refuses when the denominator is non-positive', () => {
  it('refuses when S - 3*Magnet^2 <= 0 (an oversized magnet for this Dd/Vcd)', () => {
    // S for Dd/Vcd above is 0.010975; 3*Magnet^2 must stay below that.
    const oversizedMagnet = Math.sqrt(crossSectionForTest(Dd, Vcd) / 3) * 1.01;
    const v = magDepthFromDims({ Dd, Vcd, DVol: EXPECTED_DVOL, Depth, Magnet: oversizedMagnet });
    assert.equal(v, null);
  });
});

function crossSectionForTest(dd: number, vcd: number): number {
  return dd * dd + dd * vcd + vcd * vcd;
}
