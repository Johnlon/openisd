/**
 * Picking a radiator into a project (BUG_20261031_phone-pr-p173-cms-display, John 31 Oct 2026):
 * each of Mms, Cms and Rms is copied as entered or left out, never copied and then flipped to
 * calculated. Left out when the record states its other half (Fs, Vas, Qms); the project's
 * resolve then fills it. The "can't calculate" warning marks only the empty box, never a box
 * that has a value.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const pick = (engine: Engine, radiator: Record<string, number>) => {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.box.boxType.set('box-passive-radiator');
  project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, radiator));
  return project.box.passiveRadiator.radiator.spec;
};

/** Accuton P173 as its bundled record states it: no Qms, no Rms. */
const p173 = {Fs_hz: 41, Vas_m3: 0.024, Sd_m2: 0.013, Mms_kg: 0.015, Cms_m_per_N: 0.00101, Xmax_m: 0.01};

const missing = (f: {dq: readonly {kind: string}[]}) => f.dq.some(i => i.kind === 'missing-dependencies');

describe('picking a radiator: datasheet Mms, Cms, Rms are copied or left out, never flipped', () => {
  it('P173: Mms and Cms are left out (Fs and Vas give them) and read calculated; Rms is unknown', () => {
    const spec = pick(createEngine(), p173);
    expect(spec.Mms_kg.entered).toBe(false);
    expect(spec.Mms_kg.calculated).toBe(true);
    expect(spec.Cms_m_per_N.entered).toBe(false);
    expect(spec.Cms_m_per_N.calculated).toBe(true);
    expect(spec.Cms_m_per_N.value).toBeCloseTo(0.00101, 4);
    expect(spec.Rms_kg_per_s.value).toBeNull();
  });

  it('a record stating Rms but no Qms keeps Rms entered at its value', () => {
    const spec = pick(createEngine(), {...p173, Rms_kg_per_s: 2.2});
    expect(spec.Rms_kg_per_s.entered).toBe(true);
    expect(spec.Rms_kg_per_s.value).toBe(2.2);
  });

  it('a record stating Qms and Rms leaves Rms out: Qms drives it', () => {
    const spec = pick(createEngine(), {...p173, Qms: 5, Rms_kg_per_s: 2.2});
    expect(spec.Rms_kg_per_s.entered).toBe(false);
    expect(spec.Rms_kg_per_s.value).not.toBe(2.2);
  });

  it('a record stating Cms but no Vas keeps Cms entered', () => {
    const {Vas_m3: _v, ...noVas} = p173;
    const spec = pick(createEngine(), noVas);
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Cms_m_per_N.value).toBe(0.00101);
  });

  it('a record stating Mms but no Fs keeps Mms entered', () => {
    const {Fs_hz: _f, ...noFs} = p173;
    const spec = pick(createEngine(), noFs);
    expect(spec.Mms_kg.entered).toBe(true);
    expect(spec.Mms_kg.value).toBe(0.015);
  });
});

describe('the "can\'t calculate" warning marks only the empty box', () => {
  it('P173: Qms is marked; Mms and Cms, which have values, are not', () => {
    const spec = pick(createEngine(), p173);
    expect(missing(spec.Qms)).toBe(true);
    expect(missing(spec.Mms_kg)).toBe(false);
    expect(missing(spec.Cms_m_per_N)).toBe(false);
  });

  it('the Qms warning says Rms is unknown and the charts take the radiator as lossless', () => {
    const spec = pick(createEngine(), p173);
    const text = spec.Qms.dq.map(i => i.text).join(' ');
    expect(text).toMatch(/Rms/);
    expect(text).toMatch(/lossless/);
  });
});
