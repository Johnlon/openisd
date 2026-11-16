// John, 16 Nov 2026 12:57/12:58: the phone Box tab's Key figures show the radiator's displacement Vd, so a user can hold it
// against the driver's ("2×" rule of thumb). The engine works it out: Vd = Sd · Xmax.
import {describe, expect, it} from 'vitest';
import {createEngine} from '../../engine/Engine.js';

describe('PrEngine.displacement', () => {
  it('is Sd times Xmax', () => {
    expect(createEngine().pr.displacement(0.0202, 0.012)).toBeCloseTo(0.0002424, 12);
  });
  it('is not available without a positive Sd and Xmax', () => {
    const pr = createEngine().pr;
    expect(pr.displacement(null, 0.012)).toBeNull();
    expect(pr.displacement(0.0202, null)).toBeNull();
    expect(pr.displacement(0, 0.012)).toBeNull();
  });
});

// John, 16 Nov 2026 13:00: the "2×" rule as a count of this radiator: the smallest N with N·Vd_PR ≥ 2·N_drivers·Vd_driver.
describe('PrEngine.countForTwiceDisplacement', () => {
  it('one ASP190 (242.4 cm³) is enough for one 86.95 cm³ driver (needs 173.9 cm³)', () => {
    expect(createEngine().pr.countForTwiceDisplacement(242.4e-6, 86.95e-6, 1)).toBe(1);
  });
  it('rounds up: two 100 cm³ drivers need 400 cm³, so three 150 cm³ radiators', () => {
    expect(createEngine().pr.countForTwiceDisplacement(150e-6, 100e-6, 2)).toBe(3);
  });
  it('an exact fit needs no extra radiator', () => {
    expect(createEngine().pr.countForTwiceDisplacement(200e-6, 100e-6, 1)).toBe(1);
  });
  it('is not available without both displacements', () => {
    const pr = createEngine().pr;
    expect(pr.countForTwiceDisplacement(null, 86.95e-6, 1)).toBeNull();
    expect(pr.countForTwiceDisplacement(242.4e-6, null, 1)).toBeNull();
  });
});

describe('PrEngine.twiceDriverDisplacement', () => {
  it('is twice the drivers\' displacement', () => {
    expect(createEngine().pr.twiceDriverDisplacement(86.95e-6, 1)).toBeCloseTo(173.9e-6, 12);
    expect(createEngine().pr.twiceDriverDisplacement(100e-6, 2)).toBeCloseTo(400e-6, 12);
    expect(createEngine().pr.twiceDriverDisplacement(null, 1)).toBeNull();
  });
});
