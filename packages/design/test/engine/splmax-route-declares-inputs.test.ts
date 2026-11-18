import {describe, expect, it} from 'vitest';
import {DRIVER_ROUTES, RouteGroup} from '../../engine/driver/routes/index.js';
import {FixedAir} from '../../engine/index.js';

/**
 * T902: a route declares every quantity it reads. The SPLmax route read SPL_dB, else SPLref_dB, while declaring only
 * Pe_W, so the formula panel named Pe_W alone as its input. SPLmax = base + 10·log₁₀(Pe) − 3 dB now has one route per
 * base: SPL_dB first, then SPLref_dB, each declaring the base it reads.
 */
describe('the SPLmax routes declare the sensitivity they read', () => {
  const splmax = DRIVER_ROUTES.filter(r => r.target === 'SPLmax_dB');

  it('one route from SPL_dB and Pe_W, then one from SPLref_dB and Pe_W', () => {
    expect(splmax.map(r => [...r.inputs])).toEqual([['SPL_dB', 'Pe_W'], ['SPLref_dB', 'Pe_W']]);
  });

  it('SPL_dB is the base when stated, SPLref_dB only without it, as before', () => {
    const air = new FixedAir({rho: 1.2041, c: 343.68});
    const group = new RouteGroup(splmax);
    expect(group.run({SPL_dB: 90, SPLref_dB: 80, Pe_W: 100}, air).SPLmax_dB).toBeCloseTo(90 + 20 - 3, 12);
    expect(group.run({SPLref_dB: 80, Pe_W: 100}, air).SPLmax_dB).toBeCloseTo(80 + 20 - 3, 12);
    expect(group.run({Pe_W: 100}, air).SPLmax_dB).toBeUndefined();
  });
});
