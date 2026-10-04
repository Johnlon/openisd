/**
 * `OpenISDProject.sweepPlan` — the sweep a project asks the engine for, as plain data: ready
 * (a `SweepJob` the engine runs as given) or blocked (the issues that stop it). A job crosses a
 * Worker boundary (structured clone) and running it gives exactly what `sweep()`/`maxCurves()` give.
 */
import {describe, expect, it} from 'vitest';
import {type Engine, createEngine} from '@openisd/design/engine';
import {type FrequencyGrid, ProjectBuilder} from '../../domain/index.js';
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
    const project = sealed(createEngine());
    project.box.boxType.set('bandpass6');
    const plan = project.sweepPlan(GRID);
    if (plan.kind !== 'blocked') throw new Error('expected a blocked plan');
    expect(project.sweep(GRID)).toEqual({values: null, issues: plan.issues});
  });
});
