/**
 * `OpenISDProject.sweepPlan` — the sweep a project asks the engine for, as plain data: ready
 * (a `SweepJob` the engine runs as given) or blocked (the issues that stop it). A job crosses a
 * Worker boundary (structured clone) and running it gives exactly what `sweep()`/`maxCurves()` give.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import type {FrequencyGrid} from '../../domain/box/frequencyGrid.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

const GRID: FrequencyGrid = { fmin: 10, fmax: 1000, N: 100 };

function sealed(engine: Engine) {
  const driver = driverFromSpec(engine, {
    Fs_hz: 30, Qes: 0.4, Qms: 4, Qts: 1 / (1 / 4 + 1 / 0.4), Re_ohm: 6.4,
    Sd_m2: 0.02, Cms_m_per_N: 0.0005, Vas_m3: 0.05, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100,
  });
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.powerDrive_W.set(1);
  return project;
}

describe('OpenISDProject.sweepPlan', () => {
  it('a simulatable project is ready, and its job survives a structured clone', () => {
    const plan = sealed(createEngine()).sweepPlan(GRID);
    expect(plan.kind).toBe('ready');
    if (plan.kind !== 'ready') return;
    expect(structuredClone(plan.job)).toEqual(plan.job);
  });

  it('running the cloned job gives what sweep() and maxCurves() give', () => {
    const engine = createEngine();
    const project = sealed(engine);
    const plan = project.sweepPlan(GRID);
    if (plan.kind !== 'ready') throw new Error('expected a ready plan');
    const job = structuredClone(plan.job);
    // A separate engine, as a worker builds its own.
    const other = createEngine();
    expect(other.simulation.sweep(job.driver, job.Le_H, job.box, job.sweep)).toEqual(project.sweep(GRID));
    expect(other.simulation.maxCurves(job.driver, job.Le_H, job.box, job.maxCurves)).toEqual(project.maxCurves(GRID));
  });

  it('max curves run at the 2.83 V reference, the sweep at the project drive', () => {
    const project = sealed(createEngine());
    const plan = project.sweepPlan(GRID);
    if (plan.kind !== 'ready') throw new Error('expected a ready plan');
    expect(plan.job.maxCurves.eg).toBe(2.83);
    expect(plan.job.sweep.eg).toBe(project.driveVoltage_V.value);
    expect(plan.job.sweep.eg).not.toBe(2.83);
  });

  it('a box the sweep cannot run is blocked with the issues sweep() reports', () => {
    // A driver stated by its small-signal set alone (no Cms/Mms), as sweepCache.test.ts builds it.
    const p = ProjectBuilder.empty(createEngine());
    const s = p.driver.specs;
    s.Fs_hz.set(37); s.Qts.set(0.378); s.Qes.set(0.40); s.Qms.set(7.0); s.Vas_m3.set(0.03);
    s.Sd_m2.set(0.0133); s.Re_ohm.set(5.6); s.Le_H.set(0.7e-3); s.Xmax_m.set(0.005); s.Pe_W.set(60);
    // A vented port with neither a stated tuning nor a stated length (project-sweep-guards.test.ts):
    // clearing the tuning while Vas is blank leaves the pair blank. A cleared box volume settles since
    // T211, so it no longer blocks a sweep.
    p.box.boxType.set('vented');
    const vas = p.driver.specs.Vas_m3.value;
    p.driver.specs.Vas_m3.clear();
    p.box.vented.tuning_goal_hz.clear();
    if (vas !== null) p.driver.specs.Vas_m3.set(vas);
    p.box.vented.vent.shape.set('round');
    p.box.vented.vent.diameter_m.set(0.1);
    const project = p;
    const plan = project.sweepPlan(GRID);
    if (plan.kind !== 'blocked') throw new Error('expected a blocked plan');
    expect(project.sweep(GRID)).toEqual({values: null, issues: plan.issues});
  });
});
