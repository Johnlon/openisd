import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();
const air = {rho: 1.2, c: 343};
const none = {Fs_hz: null, Qms: null, Vas_m3: null, Sd_m2: null, Mms_kg: null, Cms_m_per_N: null, Rms_kg_per_s: null};
const exact = {Fs_hz: 0, Qms: 0, Vas_m3: 0, Sd_m2: 0, Mms_kg: 0, Cms_m_per_N: 0, Rms_kg_per_s: 0};
const four = {...none, Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095};

describe('PrEngine.checkSpec: stated radiator figures against the driver consistency relations', () => {
  it('four figures alone state nothing that can disagree', () => {
    expect(engine.pr.checkSpec(four, exact, air)).toEqual([]);
  });

  it('a full set that agrees raises nothing', () => {
    const all = engine.pr.solveSpec(four, air);
    expect(engine.pr.checkSpec(all, exact, air)).toEqual([]);
  });

  it('an Mms off by 10% disagrees with Fs and Cms, and names the relation and every field in it', () => {
    const all = engine.pr.solveSpec(four, air);
    const issues = engine.pr.checkSpec({...all, Mms_kg: all.Mms_kg! * 1.1}, exact, air);
    const fs = issues.find(i => i.kind === 'inconsistent-inputs' && i.target === 'Fs_hz');
    expect(fs?.fields).toEqual(expect.arrayContaining(['Fs_hz', 'Mms_kg', 'Cms_m_per_N']));
    const rms = issues.find(i => i.kind === 'inconsistent-inputs' && i.target === 'Rms_kg_per_s');
    expect(rms?.fields).toEqual(expect.arrayContaining(['Rms_kg_per_s', 'Fs_hz', 'Mms_kg', 'Qms']));
  });

  it('a blank Qms leaves Rms unstated and raises nothing', () => {
    const {Qms: _q, ...rest} = engine.pr.solveSpec(four, air);
    expect(engine.pr.checkSpec({...rest, Qms: null, Rms_kg_per_s: null}, exact, air)).toEqual([]);
  });

  it('the shipped ND140-PR figures agree within their own stated precision', () => {
    const nd140 = {Fs_hz: 44.2, Qms: 4.02, Vas_m3: 0.0084, Sd_m2: 0.00866, Mms_kg: 0.0164, Cms_m_per_N: 0.00079, Rms_kg_per_s: null};
    const precision = {Fs_hz: 0.05, Qms: 0.005, Vas_m3: 0.00005, Sd_m2: 0.000005, Mms_kg: 0.00005, Cms_m_per_N: 0.000005, Rms_kg_per_s: 0};
    expect(engine.pr.checkSpec(nd140, precision, air)).toEqual([]);
  });

  it('the stated precision widens what counts as agreement', () => {
    const all = engine.pr.solveSpec(four, air);
    const off = {...all, Mms_kg: all.Mms_kg! * 1.1};
    expect(engine.pr.checkSpec(off, exact, air).length).toBeGreaterThan(0);
    expect(engine.pr.checkSpec(off, {...exact, Mms_kg: all.Mms_kg! * 0.2}, air)).toEqual([]);
  });
});
