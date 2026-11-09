/**
 * QO463 (John, 8 Nov 2026): a radiator figure the user types always moves the simulation. The charts
 * read Cms, Mms and Rms; Vas, Fs and Qms reach them only through those. So typing one figure works out
 * again the stated figures it moves: type Vas, Fs, Qms or Sd and the stated Cms, Mms, Rms it moves are
 * worked out (C); type Cms, Mms or Rms and the stated Vas, Fs, Qms it moves are worked out. Typing into
 * a worked-out box makes it E again. Design rule: docs/design/FIELD_CLEAR_RULE.md "Passive radiator pairs".
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

/** Accuton P173 as its bundled record states it: Fs, Vas, Sd, Mms, Cms; no Qms, no Rms. */
const p173 = {Fs_hz: 41, Vas_m3: 0.024, Sd_m2: 0.013, Mms_kg: 0.015, Cms_m_per_N: 0.00101, Xmax_m: 0.01};

describe('radiator: the figure typed last wins (QO463)', () => {
  it('typing Vas works out the stated Cms, and the stated Mms that Cms moves', () => {
    const spec = pick(createEngine(), p173);
    spec.Vas_m3.set(0.03);
    expect(spec.Vas_m3.entered).toBe(true);
    expect(spec.Cms_m_per_N.calculated).toBe(true);
    expect(spec.Cms_m_per_N.value).not.toBe(0.00101);
    expect(spec.Mms_kg.calculated).toBe(true);
    expect(spec.Fs_hz.entered).toBe(true);
  });

  it('typing Fs works out the stated Mms and keeps the stated Cms', () => {
    const spec = pick(createEngine(), p173);
    spec.Fs_hz.set(35);
    expect(spec.Mms_kg.calculated).toBe(true);
    expect(spec.Mms_kg.value).not.toBe(0.015);
    expect(spec.Cms_m_per_N.value).toBeCloseTo(0.00101, 4);
    expect(spec.Vas_m3.entered).toBe(true);
  });

  it('typing Sd works out the stated Cms when Vas is stated', () => {
    const spec = pick(createEngine(), p173);
    spec.Sd_m2.set(0.015);
    expect(spec.Cms_m_per_N.calculated).toBe(true);
    expect(spec.Vas_m3.entered).toBe(true);
  });

  it('typing Cms works out the stated Vas, and the stated Fs that Cms moves', () => {
    const spec = pick(createEngine(), p173);
    spec.Cms_m_per_N.set(0.0012);
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Vas_m3.calculated).toBe(true);
    expect(spec.Fs_hz.entered).toBe(true);
    expect(spec.Mms_kg.value).toBe(0.015);
  });

  it('typing Mms works out the stated Fs and keeps the stated Cms and Vas', () => {
    const spec = pick(createEngine(), p173);
    spec.Mms_kg.set(0.02);
    expect(spec.Mms_kg.entered).toBe(true);
    expect(spec.Cms_m_per_N.value).toBeCloseTo(0.00101, 4);
    expect(spec.Vas_m3.entered).toBe(true);
  });

  it('typing Qms works out a stated Rms; typing Rms works out a stated Qms', () => {
    const withRms = pick(createEngine(), {...p173, Rms_kg_per_s: 2.2});
    withRms.Qms.set(4);
    expect(withRms.Rms_kg_per_s.calculated).toBe(true);
    withRms.Rms_kg_per_s.set(1.5);
    expect(withRms.Rms_kg_per_s.entered).toBe(true);
    expect(withRms.Qms.calculated).toBe(true);
  });

  it('typing into a worked-out box makes it entered again and works out its partner', () => {
    const spec = pick(createEngine(), p173);
    spec.Vas_m3.set(0.03);
    expect(spec.Cms_m_per_N.calculated).toBe(true);
    spec.Cms_m_per_N.set(0.00101);
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Cms_m_per_N.value).toBeCloseTo(0.00101, 4);
    expect(spec.Vas_m3.calculated).toBe(true);
  });

  it('typing Sd keeps a stated Cms when Vas is worked out', () => {
    const spec = pick(createEngine(), p173);
    spec.Cms_m_per_N.set(0.0012);
    spec.Sd_m2.set(0.015);
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Cms_m_per_N.value).toBe(0.0012);
  });

  it('no edit leaves a stated pair in conflict', () => {
    const spec = pick(createEngine(), p173);
    spec.Vas_m3.set(0.03);
    spec.Fs_hz.set(35);
    for (const f of [spec.Vas_m3, spec.Cms_m_per_N, spec.Fs_hz, spec.Mms_kg]) {
      expect(f.dq.filter(i => i.kind !== 'missing-dependencies')).toEqual([]);
    }
  });
});
