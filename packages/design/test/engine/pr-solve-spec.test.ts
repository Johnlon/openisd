import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();
const air = {rho: 1.2, c: 343};
const none = {Fs_hz: null, Qms: null, Vas_m3: null, Sd_m2: null, Mms_kg: null, Cms_m_per_N: null, Rms_kg_per_s: null};

describe('PrEngine.solveSpec — a radiator\'s seven figures through the driver consistency relations', () => {
  it('derives Cms from Vas and Sd, Mms from Fs and Cms, Rms from Qms, Fs and Mms', () => {
    const s = engine.pr.solveSpec({...none, Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095}, air);
    const cms = 0.0048 / (air.rho * air.c * air.c * 0.0095 * 0.0095);
    const mms = 1 / ((2 * Math.PI * 30) ** 2 * cms);
    expect(s.Cms_m_per_N).toBeCloseTo(cms, 15);
    expect(s.Mms_kg! / mms).toBeCloseTo(1, 12);
    expect(s.Rms_kg_per_s! / (2 * Math.PI * 30 * mms / 3.3)).toBeCloseTo(1, 12);
  });

  it('keeps an entered Mms, Cms or Rms and derives Fs from Mms and Cms', () => {
    const s = engine.pr.solveSpec({...none, Mms_kg: 0.05, Cms_m_per_N: 0.0005, Rms_kg_per_s: 2}, air);
    expect(s.Mms_kg).toBe(0.05);
    expect(s.Cms_m_per_N).toBe(0.0005);
    expect(s.Rms_kg_per_s).toBe(2);
    expect(s.Fs_hz).toBeCloseTo(1 / (2 * Math.PI * Math.sqrt(0.05 * 0.0005)), 12);
  });

  it('leaves Rms unsolved while Qms is blank', () => {
    const s = engine.pr.solveSpec({...none, Fs_hz: 30, Vas_m3: 0.0048, Sd_m2: 0.0095}, air);
    expect(s.Rms_kg_per_s).toBeNull();
    expect(s.Mms_kg).not.toBeNull();
  });

  it('reads the air it is given', () => {
    const thin = engine.pr.solveSpec({...none, Vas_m3: 0.0048, Sd_m2: 0.0095}, {rho: 1.0, c: 343});
    const dense = engine.pr.solveSpec({...none, Vas_m3: 0.0048, Sd_m2: 0.0095}, {rho: 1.2, c: 343});
    expect(thin.Cms_m_per_N! / dense.Cms_m_per_N!).toBeCloseTo(1.2, 12);
  });
});
