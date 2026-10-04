/**
 * A radiator's Mms, Cms and Rms are calculated values: the project's resolve fills them from the
 * radiator's Fs, Qms, Vas and Sd through the driver consistency relations, and a typed value wins.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/index.js';
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

describe('radiator Mms, Cms and Rms are calculated', () => {
  const four = {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095};

  it('read as calculated once the four figures are stated', () => {
    const spec = prProject(createEngine(), four).box.passiveRadiator.radiator.spec;
    for (const f of [spec.Mms_kg, spec.Cms_m_per_N, spec.Rms_kg_per_s]) {
      expect(f.calculated).toBe(true);
      expect(f.value).toBeGreaterThan(0);
    }
  });

  it('follow an edit to Fs, Qms, Vas or Sd', () => {
    const spec = prProject(createEngine(), four).box.passiveRadiator.radiator.spec;
    const mech = () => [spec.Mms_kg.value, spec.Cms_m_per_N.value, spec.Rms_kg_per_s.value];
    for (const edit of [() => spec.Fs_hz.set(20), () => spec.Qms.set(1.5), () => spec.Vas_m3.set(0.012)]) {
      const before = mech();
      edit();
      expect(mech()).not.toEqual(before);
    }
  });

  it('a record carrying entered Mms, Cms and Rms embeds them as calculated, driven by the four', () => {
    const spec = prProject(createEngine(), {...four, Mms_kg: 1, Cms_m_per_N: 1, Rms_kg_per_s: 1}).box.passiveRadiator.radiator.spec;
    for (const f of [spec.Mms_kg, spec.Cms_m_per_N, spec.Rms_kg_per_s]) {
      expect(f.entered).toBe(false);
      expect(f.value).not.toBe(1);
    }
  });

  it('a record stating only Mms, Cms and Rms keeps them entered and derives Fs', () => {
    const spec = prProject(createEngine(), {Mms_kg: 0.05, Cms_m_per_N: 0.0005, Sd_m2: 0.02}).box.passiveRadiator.radiator.spec;
    expect(spec.Mms_kg.entered).toBe(true);
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Fs_hz.calculated).toBe(true);
  });

  it('a typed Mms stays entered and wins over the derived one', () => {
    const spec = prProject(createEngine(), four).box.passiveRadiator.radiator.spec;
    spec.Mms_kg.set(0.123);
    expect(spec.Mms_kg.entered).toBe(true);
    expect(spec.Mms_kg.value).toBe(0.123);
  });

  it('without a Qms there is no Rms', () => {
    const {Qms: _q, ...noQms} = four;
    const spec = prProject(createEngine(), noQms).box.passiveRadiator.radiator.spec;
    expect(spec.Rms_kg_per_s.value).toBeNull();
    expect(spec.Mms_kg.value).not.toBeNull();
  });

  it('uses the project air (ρc² follows pressure)', () => {
    const cool = prProject(createEngine(), four);
    const hot = prProject(createEngine(), four);
    hot.envUseWinisdAirModel.set(false);
    hot.envPressurePa.set(90000);
    cool.envUseWinisdAirModel.set(false);
    expect(hot.box.passiveRadiator.radiator.spec.Cms_m_per_N.value)
      .not.toBe(cool.box.passiveRadiator.radiator.spec.Cms_m_per_N.value);
  });
  // BUG_20261004_winisd-pr-vas-box-emptied-crashes: WinISD dies when its Vas box is emptied. The UI writes 0 when a
  // radiator field is cleared, so a zero in any of the four figures must leave no NaN, Infinity or throw.
  it.each(['Fs_hz', 'Qms', 'Vas_m3', 'Sd_m2'] as const)('a zero %s leaves every derived value finite or absent', field => {
    const project = prProject(createEngine(), four);
    const spec = project.box.passiveRadiator.radiator.spec;
    spec[field].set(0);
    const shown = [spec.Mms_kg.value, spec.Cms_m_per_N.value, spec.Rms_kg_per_s.value,
      project.box.passiveRadiator.naturalTuning_hz.value];
    for (const v of shown) expect(v === null || Number.isFinite(v)).toBe(true);
  });
});
