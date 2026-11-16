/**
 * T744, QO535: a driver figure typed in the What-if panel moves the figures that follow it (the engine's What-if rule), the boxes
 * carry no disagreement mark, the charts use the moved boxes, and closing the What-if leaves the project as it was.
 */
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = {fmin: 10, fmax: 2000, N: 40};
const E150HE_44 = {
  Fs_hz: 40, Vas_m3: 0.00765, Mms_kg: 0.0266, Cms_m_per_N: 0.0006, Qms: 2.94, Qes: 0.46,
  Re_ohm: 6.6, Sd_m2: 0.0095, Xmax_m: 0.008, Pe_W: 100,
};

function whatIf() {
  const engine = createEngine();
  const project = new ProjectBuilder(driverFromSpec(engine, E150HE_44), engine).sealed().volume_m3(0.012).build();
  project.beginWhatIf();
  return project;
}

const anyMark = (p: ReturnType<typeof whatIf>): boolean =>
  p.driver.issues().some(issue => issue.kind === 'inconsistent-inputs');

describe('QO535 What-if, driver figures', () => {
  it('opening the What-if on a driver whose stated figures disagree shows no mark, before anything is typed', () => {
    const engine = createEngine();
    const project = new ProjectBuilder(driverFromSpec(engine, {...E150HE_44, Mms_kg: 0.035}), engine).sealed().volume_m3(0.012).build();
    expect(anyMark(project)).toBe(true);
    project.beginWhatIf();
    expect(anyMark(project)).toBe(false);
    expect(project.driver.specs.Fs_hz.dq.length).toBe(0);
    expect(project.driver.specs.Mms_kg.dq.length).toBe(0);
    project.cancelWhatIf();
    expect(anyMark(project)).toBe(true);
  });

  it('Mms typed (row 5): Fs and the Qs follow, Vas and Cms stay, no box is marked, the charts move', () => {
    const p = whatIf();
    const before = p.sweep(GRID).values!.spl;
    p.driver.specField('Mms_kg').set(0.0346, 0.00005);
    const s = p.driver.specs;
    expect(s.Mms_kg.value).toBe(0.0346);
    expect(s.Fs_hz.value).toBeCloseTo(35, 0);
    expect(s.Qms.value).toBeCloseTo(3.35, 2);
    expect(s.Qes.value).toBeCloseTo(0.52, 2);
    expect(s.Vas_m3.value).toBe(0.00765);
    expect(s.Cms_m_per_N.value).toBe(0.0006);
    expect(anyMark(p)).toBe(false);
    expect(Math.max(...p.sweep(GRID).values!.spl.map((v, i) => Math.abs(v - before[i]!)))).toBeGreaterThan(0.01);
  });

  it('Fs typed (row 1): Vas and the Qs stay, Mms 34.7 g; the charts use the moved Mms', () => {
    const p = whatIf();
    p.driver.specField('Fs_hz').set(35, 0.005);
    const s = p.driver.specs;
    expect(s.Vas_m3.value).toBe(0.00765);
    expect(s.Qes.value).toBe(0.46);
    expect(s.Qms.value).toBe(2.94);
    expect(s.Mms_kg.value).toBeCloseTo(0.0347, 4);
    expect(s.sweepDriver().values.Mms_kg).toBeCloseTo(0.0347, 4);
    expect(anyMark(p)).toBe(false);
  });

  it('Qts typed (row 3): Qes 0.53, Qms stays', () => {
    const p = whatIf();
    p.driver.specField('Qts').set(0.45, 0.005);
    expect(p.driver.specs.Qes.value).toBeCloseTo(0.53, 2);
    expect(p.driver.specs.Qms.value).toBe(2.94);
  });

  it('closing the What-if leaves the project as it was', () => {
    const p = whatIf();
    p.driver.specField('Cms_m_per_N').set(0.0008, 0.000005);
    p.cancelWhatIf();
    const s = p.driver.specs;
    expect([s.Fs_hz.value, s.Vas_m3.value, s.Mms_kg.value, s.Cms_m_per_N.value, s.Qms.value]).toEqual([40, 0.00765, 0.0266, 0.0006, 2.94]);
  });

  it('outside a What-if the same edit moves nothing else (QO534)', () => {
    const engine = createEngine();
    const p = new ProjectBuilder(driverFromSpec(engine, E150HE_44), engine).sealed().volume_m3(0.012).build();
    p.driver.specField('Mms_kg').set(0.0346, 0.00005);
    expect(p.driver.specs.Fs_hz.value).toBe(40);
    expect(p.driver.specs.Qms.value).toBe(2.94);
  });
});
