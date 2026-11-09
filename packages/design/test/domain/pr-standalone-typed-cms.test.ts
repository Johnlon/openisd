/**
 * QO463 (John, 8 Nov 2026): a Cms typed on a standalone radiator (the New Project wizard's copy) works
 * Vas out again, and drops the stated Fs the stated Mms ties to, as on a radiator in a project.
 * ASP190 states Fs, Vas, Sd, Mms, Cms and Rms.
 */
import {describe, expect, it} from 'vitest';
import {FixedAir, createEngine} from '@openisd/design/engine';
import {radiatorFromSpec} from '../fixtures/recordBuilders.js';

describe('standalone radiator: a typed Cms (QO463)', () => {
  it('works Vas out from Cms and Sd, and drops the stated Fs and Qms that follow', () => {
    const engine = createEngine();
    const air = new FixedAir(engine.environment.solve(engine.environment.defaults()).values);
    const pr = radiatorFromSpec(engine, {Fs_hz: 33, Vas_m3: 0.027, Sd_m2: 0.0202, Mms_kg: 0.05, Cms_m_per_N: 0.00046, Rms_kg_per_s: 2.2});
    pr.resolve(engine.pr, air);
    pr.spec.Cms_m_per_N.set(0.001);
    pr.resolve(engine.pr, air);
    expect(pr.spec.Cms_m_per_N.value).toBe(0.001);
    expect(pr.spec.Vas_m3.calculated).toBe(true);
    expect(pr.spec.Vas_m3.value).not.toBe(0.027);
    expect(pr.spec.Fs_hz.calculated).toBe(true);
    expect(pr.spec.Mms_kg.entered).toBe(true);
  });
});
