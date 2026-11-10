/**
 * T744, John 10 Nov 2026 (QO530): a figure the user types never moves; the charts use exactly what the boxes show.
 * One test per rule, driver and radiator. Rule numbers are the QO530 list (1 What-if, 3-5 driver editor, 6 radiator).
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 2000, N: 40};
const TAU = 2 * Math.PI;
/** Fs, Vas, Sd stated; Mms, Cms blank (worked out). */
const BASE = {Fs_hz: 40, Qes: 0.45, Qms: 2.94, Re_ohm: 6.6, Sd_m2: 0.009503, Vas_m3: 0.007645536, Xmax_m: 0.008, Pe_W: 100};
const cmsOf = (fs: number, mms: number): number => 1 / ((TAU * fs) ** 2 * mms);

function driverProject(spec: Record<string, number>) {
  const engine = createEngine();
  return new ProjectBuilder(driverFromSpec(engine, spec), engine).sealed().volume_m3(0.03).build();
}

const maxDiff = (a: readonly number[], b: readonly number[]): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

describe('QO530 driver editor', () => {
  it('rule 3: Fs typed, Vas blank, type Mms: Vas and Cms are worked out and shown as calculated; Fs and Mms never move', () => {
    const {Vas_m3: _vas, ...noVas} = BASE;
    const project = driverProject({...noVas, Sd_m2: BASE.Sd_m2});
    project.driver.specField('Mms_kg').set(0.03);
    const {Fs_hz, Mms_kg, Cms_m_per_N, Vas_m3} = project.driver.specs;
    expect(Fs_hz.entered).toBe(true);
    expect(Fs_hz.value).toBe(40);
    expect(Mms_kg.entered).toBe(true);
    expect(Mms_kg.value).toBe(0.03);
    expect(Cms_m_per_N.calculated).toBe(true);
    expect(Cms_m_per_N.value).toBeCloseTo(cmsOf(40, 0.03), 9);
    expect(Vas_m3.calculated).toBe(true);
    expect(Vas_m3.value).toBeGreaterThan(0);
  });

  it('rule 4: Fs, Vas, Mms stated and Mms changed: nothing moves, charts use Fs and the new Mms, Vas carries the one-sentence warning', () => {
    const project = driverProject(BASE);
    const before = project.sweep(GRID).values!.spl;
    project.driver.specField('Mms_kg').set(0.03);
    const {Fs_hz, Mms_kg, Cms_m_per_N, Vas_m3} = project.driver.specs;
    expect(Fs_hz.value).toBe(40);
    expect(Mms_kg.value).toBe(0.03);
    expect(Mms_kg.entered).toBe(true);
    expect(Vas_m3.entered).toBe(true);
    expect(Vas_m3.value).toBe(BASE.Vas_m3);
    // The box shows the Cms the charts use, worked out from Fs and the new Mms.
    expect(Cms_m_per_N.value).toBeCloseTo(cmsOf(40, 0.03), 9);
    expect(project.driver.specs.sweepDriver().values.Cms_m_per_N).toBeCloseTo(cmsOf(40, 0.03), 9);
    expect(project.driver.specs.sweepDriver().values.Mms_kg).toBe(0.03);
    expect(maxDiff(project.sweep(GRID).values!.spl, before)).toBeGreaterThan(0.01);
    expect(Vas_m3.dq.map(i => i.text)).toEqual(['Vas disagrees with Fs and Mms, so the charts use Fs and Mms.']);
  });

  it('rule 5: Vas stated, Cms typed: Vas stays, charts use the typed Cms, Vas carries the warning', () => {
    const project = driverProject(BASE);
    project.driver.specField('Cms_m_per_N').set(0.0005);
    const {Cms_m_per_N, Vas_m3} = project.driver.specs;
    expect(Cms_m_per_N.entered).toBe(true);
    expect(Cms_m_per_N.value).toBe(0.0005);
    expect(Vas_m3.entered).toBe(true);
    expect(Vas_m3.value).toBe(BASE.Vas_m3);
    expect(project.driver.specs.sweepDriver().values.Cms_m_per_N).toBe(0.0005);
    expect(Vas_m3.dq.map(i => i.text)).toEqual(['Vas disagrees with your Cms, so the charts use your Cms.']);
  });

  it('rule 7: a loaded file with Cms and Vas stated and disagreeing follows the Cms from Vas option (no typing, so no warning on Vas)', () => {
    const project = driverProject({...BASE, Cms_m_per_N: 0.0005});
    expect(project.driver.specs.Cms_m_per_N.value).not.toBe(0.0005);
    expect(project.driver.specs.Vas_m3.dq.map(i => i.text).filter(t => /^Vas disagrees/.test(t))).toEqual([]);
  });

  it('a Vas typed after a Cms was typed is last: Vas wins again and the warning goes', () => {
    const project = driverProject(BASE);
    project.driver.specField('Cms_m_per_N').set(0.0005);
    project.driver.specField('Vas_m3').set(0.01);
    expect(project.driver.specs.Vas_m3.value).toBe(0.01);
    expect(project.driver.specs.Vas_m3.dq.map(i => i.text).filter(t => /^Vas disagrees/.test(t))).toEqual([]);
  });
});

describe('QO530 What-if', () => {
  it('rule 1: a typed heavier Mms acts like added mass: Fs drops, Vas and Cms stay, Qms follows Mms with Rms fixed', () => {
    const project = driverProject({...BASE, Mms_kg: 0.0147, Rms_kg_per_s: 1.2});
    const {Vas_m3, Cms_m_per_N, Fs_hz, Qms} = project.driver.specs;
    const cms = Cms_m_per_N.value;
    const fs = Fs_hz.value!;
    project.beginWhatIf();
    project.driver.specField('Mms_kg').set(0.03);
    expect(Fs_hz.entered).toBe(false);
    expect(project.driver.specs.Fs_hz.value!).toBeLessThan(fs);
    expect(project.driver.specs.Vas_m3.value).toBe(Vas_m3.value);
    expect(project.driver.specs.Cms_m_per_N.value).toBeCloseTo(cms!, 12);
    expect(project.driver.specs.Fs_hz.value!).toBeCloseTo(1 / (TAU * Math.sqrt(0.03 * cms!)), 6);
    expect(project.driver.specs.Qms.entered).toBe(false);
    expect(project.driver.specs.Qms.value!).toBeCloseTo(TAU * project.driver.specs.Fs_hz.value! * 0.03 / 1.2, 6);
    expect(Qms).toBeDefined();
  });
});

describe('QO530 radiator tab', () => {
  const p173 = {Fs_hz: 41, Vas_m3: 0.024, Sd_m2: 0.013, Mms_kg: 0.015, Cms_m_per_N: 0.00101, Xmax_m: 0.01};
  function pick(radiator: Record<string, number>) {
    const engine = createEngine();
    const project = driverProject(BASE);
    project.box.boxType.set('box-passive-radiator');
    project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, radiator));
    return {project, spec: project.box.passiveRadiator.radiator.spec};
  }

  it('rule 6 (3): Fs typed, Vas blank, type Mms: Cms and Vas worked out, shown as calculated', () => {
    const {spec} = pick({Fs_hz: 41, Sd_m2: 0.013, Xmax_m: 0.01});
    spec.Mms_kg.set(0.02);
    expect(spec.Fs_hz.value).toBe(41);
    expect(spec.Mms_kg.entered).toBe(true);
    expect(spec.Cms_m_per_N.calculated).toBe(true);
    expect(spec.Cms_m_per_N.value).toBeCloseTo(cmsOf(41, 0.02), 9);
    expect(spec.Vas_m3.calculated).toBe(true);
  });

  it('rule 6 (4): Fs, Vas, Mms stated and Mms changed: nothing moves, charts use Fs and the new Mms, Vas carries the warning', () => {
    const {project, spec} = pick(p173);
    spec.Mms_kg.set(0.03);
    expect(spec.Fs_hz.value).toBe(41);
    expect(spec.Vas_m3.entered).toBe(true);
    expect(spec.Vas_m3.value).toBe(0.024);
    expect(spec.Mms_kg.value).toBe(0.03);
    expect(spec.Cms_m_per_N.value).toBeCloseTo(cmsOf(41, 0.03), 9);
    expect(project.box.passiveRadiator.radiator.spec.Cms_m_per_N.value).toBe(spec.Cms_m_per_N.value);
    expect(spec.Vas_m3.dq.map(i => i.text)).toEqual(['Vas disagrees with Fs and Mms, so the charts use Fs and Mms.']);
  });

  it('rule 6 (5): Vas stated, Cms typed: Vas stays, charts use the typed Cms, Vas carries the warning', () => {
    const {spec} = pick(p173);
    spec.Cms_m_per_N.set(0.0012);
    expect(spec.Cms_m_per_N.entered).toBe(true);
    expect(spec.Cms_m_per_N.value).toBe(0.0012);
    expect(spec.Vas_m3.entered).toBe(true);
    expect(spec.Vas_m3.value).toBe(0.024);
    expect(spec.Fs_hz.value).toBe(41);
    expect(spec.Vas_m3.dq.map(i => i.text)).toEqual(['Vas disagrees with your Cms, so the charts use your Cms.']);
  });
});
