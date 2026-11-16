/**
 * "Chart from Fs, Vas, Qms (WinISD's way)" covers the passive radiator as it covers the driver (QO539, John picked B; his
 * approved help: "datasheets often state Mms, Cms and Rms that do not agree with their own Fs, Vas and Qms"). Unticked, the
 * charts use the radiator's Mms, Cms and Rms boxes (QO534); ticked, Cms from Vas and Sd, Mms from Fs and that Cms, and Rms from
 * Fs, that Mms and Qms, as WinISD does. The boxes keep their stated values either way.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 500, N: 60};
const FOUR = {Fs_hz: 30, Qms: 3.3, Vas_m3: 0.0048, Sd_m2: 0.0095};

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

const splOf = (p: ReturnType<typeof prProject>): readonly number[] => {
  const values = p.sweep(GRID).values;
  if (values === null) throw new Error('the sweep did not run');
  return values.spl;
};
const maxGap = (a: readonly number[], b: readonly number[]): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

describe('Chart from Fs, Vas, Qms: the passive radiator', () => {
  it('unticked, the charts use the stated Mms, Cms and Rms boxes, which disagree with Fs, Vas and Qms', () => {
    const engine = createEngine();
    const stated = prProject(engine, {...FOUR, Mms_kg: 0.05, Cms_m_per_N: 0.0006, Rms_kg_per_s: 2});
    const derived = prProject(engine, FOUR);
    expect(stated.winisdChartFromFsVasQms.value).toBe(false);
    expect(maxGap(splOf(stated), splOf(derived))).toBeGreaterThan(0.5);
  });

  it('ticked, the charts are the ones Fs, Vas and Qms give (Cms from Vas and Sd, Mms from Fs, Rms from Qms), and the boxes keep their values', () => {
    const engine = createEngine();
    const stated = prProject(engine, {...FOUR, Mms_kg: 0.05, Cms_m_per_N: 0.0006, Rms_kg_per_s: 2});
    const derived = prProject(engine, FOUR);
    stated.winisdChartFromFsVasQms.set(true);
    derived.winisdChartFromFsVasQms.set(true);
    expect(maxGap(splOf(stated), splOf(derived))).toBeLessThan(1e-6);
    const spec = stated.box.passiveRadiator.radiator.spec;
    expect([spec.Mms_kg.value, spec.Cms_m_per_N.value, spec.Rms_kg_per_s.value]).toEqual([0.05, 0.0006, 2]);
  });

  it('ticked, a radiator that states no Vas keeps its stated Cms and works Mms and Rms out from it', () => {
    const engine = createEngine();
    const noVas = {Fs_hz: 30, Qms: 3.3, Sd_m2: 0.0095};
    const stated = prProject(engine, {...noVas, Mms_kg: 0.05, Cms_m_per_N: 0.0006, Rms_kg_per_s: 2});
    const fromCms = prProject(engine, {...noVas, Cms_m_per_N: 0.0006});
    stated.winisdChartFromFsVasQms.set(true);
    fromCms.winisdChartFromFsVasQms.set(true);
    expect(maxGap(splOf(stated), splOf(fromCms))).toBeLessThan(1e-6);
  });

  it('the tuning readouts follow the figures the charts use: unticked the boxes, ticked the ones Fs, Vas and Qms give', () => {
    const engine = createEngine();
    const stated = prProject(engine, {...FOUR, Mms_kg: 0.05, Cms_m_per_N: 0.0006, Rms_kg_per_s: 2});
    const derived = prProject(engine, FOUR);
    const readouts = (p: ReturnType<typeof prProject>) => {
      const pr = p.box.passiveRadiator;
      return [pr.naturalTuning_hz.value, pr.systemTuning_hz.value, pr.resonanceWithAddedMass_hz.value, pr.addedMassForTuning_kg(40).value];
    };
    const near = (a: readonly (number | null)[], b: readonly (number | null)[]) => a.every((v, i) => v !== null && b[i] !== null && Math.abs(v - b[i]!) < 1e-9);
    expect(near(readouts(stated), readouts(derived))).toBe(false);
    stated.winisdChartFromFsVasQms.set(true);
    derived.winisdChartFromFsVasQms.set(true);
    expect(readouts(stated).every(v => v !== null)).toBe(true);
    expect(near(readouts(stated), readouts(derived))).toBe(true);
  });

  it('ticked, the box losses (leak Ql and absorption Qa, fixed at the radiator resonance) follow the Fr that Fs, Vas and Qms give, not the stated boxes', () => {
    const engine = createEngine();
    const leaky = (radiator: Record<string, number>) => {
      const p = prProject(engine, radiator);
      p.box.passiveRadiator.losses.Ql.set(2);
      p.box.passiveRadiator.losses.Qa.set(3);
      return p;
    };
    const stated = leaky({...FOUR, Mms_kg: 0.05, Cms_m_per_N: 0.0006, Rms_kg_per_s: 2});
    const derived = leaky(FOUR);
    expect(maxGap(splOf(stated), splOf(derived))).toBeGreaterThan(0.5);
    stated.winisdChartFromFsVasQms.set(true);
    derived.winisdChartFromFsVasQms.set(true);
    expect(maxGap(splOf(stated), splOf(derived))).toBeLessThan(1e-6);
  });
});
