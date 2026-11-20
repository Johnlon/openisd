import {describe, expect, it} from 'vitest';
import {arrayPowerHandling} from '../../engine/array/driverWiring.js';

// WinISD's Maximum power: Pe x Nd, x 2 for an Iso-Barik pair (two drivers per position), W5-1138SMF Pe 40 W:
// 40 / 80 / 80 / 160 W at Nd 1, Nd 1 Iso-Barik, Nd 2, Nd 2 Iso-Barik (winisd_research runs/isobarik-more-20261119).
describe('arrayPowerHandling', () => {
  it('is Pe x Nd for standard placement', () => {
    expect(arrayPowerHandling(40, 1, 'standard')).toBe(40);
    expect(arrayPowerHandling(40, 2, 'standard')).toBe(80);
  });
  it('counts an Iso-Barik pair as two drivers', () => {
    expect(arrayPowerHandling(40, 1, 'isobaric')).toBe(80);
    expect(arrayPowerHandling(40, 2, 'isobaric')).toBe(160);
  });
});
