/**
 * QO530 (John, 10 Nov 2026): a Cms typed on a standalone radiator (the New Project wizard's copy) moves nothing else.
 * ASP190 states Fs, Vas, Sd, Mms, Cms and Rms.
 */
import {describe, expect, it} from 'vitest';
import {FixedAir, createEngine} from '@openisd/design/engine';
import {radiatorFromSpec} from '../fixtures/recordBuilders.js';

describe('standalone radiator: a typed Cms (QO463)', () => {
  it('leaves the stated Vas, Fs and Mms as they are (QO530: a typed value moves nothing)', () => {
    const engine = createEngine();
    const air = new FixedAir(engine.environment.solve(engine.environment.defaults()).values);
    const pr = radiatorFromSpec(engine, {Fs_hz: 33, Vas_m3: 0.027, Sd_m2: 0.0202, Mms_kg: 0.05, Cms_m_per_N: 0.00046, Rms_kg_per_s: 2.2});
    pr.resolve(engine.pr, air);
    pr.spec.Cms_m_per_N.set(0.001);
    pr.resolve(engine.pr, air);
    expect(pr.spec.Cms_m_per_N.value).toBe(0.001);
    expect(pr.spec.Vas_m3.entered).toBe(true);
    expect(pr.spec.Vas_m3.value).toBe(0.027);
    expect(pr.spec.Fs_hz.entered).toBe(true);
    expect(pr.spec.Mms_kg.entered).toBe(true);
  });
});
