/**
 * A radiator's figures can disagree after picking it or editing it. Every field in a disagreeing
 * relation is marked, and the mark clears when the conflicting entry is cleared.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const prProject = (engine: Engine, radiator: Record<string, number>) => {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.box.boxType.set('box-passive-radiator');
  project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, radiator));
  project.box.passiveRadiator.count.set(1);
  return project;
};

const four = {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095};
const marked = (f: {dq: readonly {kind: string}[]}) => f.dq.some(i => i.kind === 'inconsistent-inputs');

describe('radiator figure conflicts reach the fields', () => {
  it('a consistent radiator marks nothing', () => {
    const spec = prProject(createEngine(), four).box.passiveRadiator.radiator.spec;
    for (const f of [spec.Fs_hz, spec.Qms, spec.Vas_m3, spec.Sd_m2, spec.Mms_kg, spec.Cms_m_per_N, spec.Rms_kg_per_s]) {
      expect(f.dq).toEqual([]);
    }
  });

  it('typing a conflicting Mms marks Mms, Fs and Cms while leaving Qms unmarked', () => {
    const spec = prProject(createEngine(), four).box.passiveRadiator.radiator.spec;
    const affected = [spec.Mms_kg, spec.Fs_hz, spec.Cms_m_per_N];
    expect(affected.map(marked)).toEqual([false, false, false]);

    spec.Mms_kg.set(0.12);

    expect(affected.map(marked)).toEqual([true, true, true]);
    expect(marked(spec.Qms)).toBe(false);
  });

  it('typing a 50% increase in Mms marks Mms, Fs and Cms while leaving Qms unmarked', () => {
    const spec = prProject(createEngine(), four).box.passiveRadiator.radiator.spec;
    const originalMms = spec.Mms_kg.value;
    if (originalMms === null) throw new Error('Expected a calculated Mms before typing');

    spec.Mms_kg.set(originalMms * 1.5);

    expect([spec.Mms_kg, spec.Fs_hz, spec.Cms_m_per_N].map(marked)).toEqual([true, true, true]);
    expect(marked(spec.Qms)).toBe(false);
  });

  it('clearing a typed Mms removes all three conflict marks and restores calculated Mms', () => {
    const spec = prProject(createEngine(), four).box.passiveRadiator.radiator.spec;
    const originalMms = spec.Mms_kg.value;
    expect(originalMms).toBeGreaterThan(0);
    spec.Mms_kg.set(0.12);
    const affected = [spec.Mms_kg, spec.Fs_hz, spec.Cms_m_per_N];
    expect(affected.map(marked)).toEqual([true, true, true]);

    spec.Mms_kg.clear();

    expect(affected.map(marked)).toEqual([false, false, false]);
    expect(spec.Mms_kg.calculated).toBe(true);
    expect(spec.Mms_kg.value).toBe(originalMms);
  });

  const offMms = (engine: Engine) => ({...four, Mms_kg: prProject(engine, four).box.passiveRadiator.radiator.spec.Mms_kg.value! * 1.5});

  it('a stated Mms that disagrees marks Mms, Fs and Cms', () => {
    const engine = createEngine();
    const spec = prProject(engine, offMms(engine)).box.passiveRadiator.radiator.spec;
    expect(marked(spec.Mms_kg)).toBe(true);
    expect(marked(spec.Fs_hz)).toBe(true);
    expect(marked(spec.Cms_m_per_N)).toBe(true);
    expect(marked(spec.Qms)).toBe(false);
  });

  it('clearing the stated Mms removes the mark', () => {
    const engine = createEngine();
    const spec = prProject(engine, offMms(engine)).box.passiveRadiator.radiator.spec;
    spec.Mms_kg.clear();
    for (const f of [spec.Fs_hz, spec.Mms_kg, spec.Cms_m_per_N]) expect(marked(f)).toBe(false);
  });

  // "just show errors" (John, 2026-10-06, bugs/BUG_20261005_no-common-ui-field-component.md): a
  // blank figure the simulation needs is flagged, naming what to state.
  it('a blank Qms is flagged as what Rms still needs', () => {
    const {Qms: _q, ...noQms} = four;
    const spec = prProject(createEngine(), noQms).box.passiveRadiator.radiator.spec;
    expect(spec.Qms.mandatoryAndUnsatisfied).toBe(true);
    expect(spec.Qms.dq.map(i => i.text).join()).toMatch(/mechanical resistance \(Rms\) cannot be calculated yet.*needs Qms/);
  });

  it('a blank Vas is flagged as what Cms still needs', () => {
    const {Vas_m3: _v, ...noVas} = four;
    const spec = prProject(createEngine(), noVas).box.passiveRadiator.radiator.spec;
    expect(spec.Vas_m3.mandatoryAndUnsatisfied).toBe(true);
    expect(spec.Vas_m3.dq.map(i => i.text).join()).toMatch(/compliance \(Cms\) cannot be calculated yet.*needs equivalent volume \(Vas\)/);
  });
});
