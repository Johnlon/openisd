import {describe, expect, it} from 'vitest';
import {DRIVER_ROUTES, RouteGroup} from '../../engine/driver/routes/index.js';
import type {RouteQuantity} from '../../engine/driver/routes/index.js';
import {FixedAir} from '../../engine/index.js';

/**
 * T902: a route declares every quantity it reads. USPL and Re-from-USPL read SPL_dB, else SPLref_dB, and Mcost read Hc_m
 * and Hg_m, none of them declared, so the formula panel left them out of the inputs it names. Each now has one route per
 * base, declaring it; Mcost declares Hc_m and Hg_m. The values are as before.
 */
const air = new FixedAir({rho: 1.2041, c: 343.68});
const routesTo = (target: RouteQuantity) => DRIVER_ROUTES.filter(r => r.target === target);
const V283_SQ = 2.83 * 2.83;

describe('the USPL, Re-from-USPL and Mcost routes declare what they read', () => {
  it('USPL: one route from SPL_dB and Re_ohm, then one from SPLref_dB and Re_ohm', () => {
    expect(routesTo('USPL_dB').map(r => [...r.inputs])).toEqual([['SPL_dB', 'Re_ohm'], ['SPLref_dB', 'Re_ohm']]);
  });

  it('Re from USPL: one route from USPL_dB and SPL_dB, then one from USPL_dB and SPLref_dB', () => {
    const fromUspl = routesTo('Re_ohm').filter(r => r.inputs.includes('USPL_dB'));
    expect(fromUspl.map(r => [...r.inputs])).toEqual([['USPL_dB', 'SPL_dB'], ['USPL_dB', 'SPLref_dB']]);
  });

  it('Mcost: reads Rme, Xmax, Hc and Hg, and declares all four', () => {
    expect(routesTo('Mcost_kg_per_s').map(r => [...r.inputs])).toEqual([['Rme_kg_per_s', 'Xmax_m', 'Hc_m', 'Hg_m']]);
  });

  it('USPL takes SPL_dB when stated, SPLref_dB only without it', () => {
    const group = new RouteGroup(routesTo('USPL_dB'));
    expect(group.run({SPL_dB: 90, SPLref_dB: 80, Re_ohm: 4}, air).USPL_dB).toBeCloseTo(90 + 10 * Math.log10(V283_SQ / 4), 12);
    expect(group.run({SPLref_dB: 80, Re_ohm: 4}, air).USPL_dB).toBeCloseTo(80 + 10 * Math.log10(V283_SQ / 4), 12);
    expect(group.run({Re_ohm: 4}, air).USPL_dB).toBeUndefined();
  });

  it('Re from USPL takes SPL_dB when stated, SPLref_dB only without it', () => {
    const group = new RouteGroup(routesTo('Re_ohm').filter(r => r.inputs.includes('USPL_dB')));
    expect(group.run({USPL_dB: 93, SPL_dB: 90, SPLref_dB: 80}, air).Re_ohm).toBeCloseTo(V283_SQ / Math.pow(10, 0.3), 12);
    expect(group.run({USPL_dB: 83, SPLref_dB: 80}, air).Re_ohm).toBeCloseTo(V283_SQ / Math.pow(10, 0.3), 12);
    expect(group.run({USPL_dB: 93}, air).Re_ohm).toBeUndefined();
  });

  it('Mcost is Rme·(1 + Xmax/min(Hc, Hg)), and stays absent without both heights or with a zero one', () => {
    const group = new RouteGroup(routesTo('Mcost_kg_per_s'));
    expect(group.run({Rme_kg_per_s: 10, Xmax_m: 0.004, Hc_m: 0.012, Hg_m: 0.006}, air).Mcost_kg_per_s).toBeCloseTo(10 * (1 + 0.004 / 0.006), 12);
    expect(group.run({Rme_kg_per_s: 10, Xmax_m: 0.004, Hc_m: 0.012}, air).Mcost_kg_per_s).toBeUndefined();
    expect(group.run({Rme_kg_per_s: 10, Xmax_m: 0.004, Hc_m: 0.012, Hg_m: 0}, air).Mcost_kg_per_s).toBeUndefined();
  });
});
