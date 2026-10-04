import { describe, it, expect } from 'vitest';
import { createEngine, type FrequencyGrid, OpenISDProject, ProjectBuilder } from '../../domain/index.js';
import { driverFromSpec } from '../fixtures/recordBuilders.js';

const W5 = { Fs_hz: 45, Re_ohm: 3.4, Le_H: 0.00034, BL_Tm: 7.17, Qes: 0.57, Qms: 3.56, Vas_m3: 0.00485, Sd_m2: 0.0094, Pe_W: 40 };

function projectWithWrap(winisdWrapPhase?: boolean) {
  const engine = createEngine();
  const driver = driverFromSpec(engine, W5);
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.01).build();
  project.powerDrive_W.set(1);
  if (winisdWrapPhase !== undefined) {
    project.winisdWrapPhase.set(winisdWrapPhase);
  }
  return project;
}

describe('winisdWrapPhase', () => {
  it('defaults to true', () => {
    const p = projectWithWrap();
    expect(p.winisdWrapPhase.value).toBe(true);
  });

  it('on keeps the phase inside ±π; off lets it run past -π where the response turns more than 180°', () => {
    const grid: FrequencyGrid = { fmin: 1, fmax: 20000, N: 400 };
    const wrapped = projectWithWrap(true).sweep(grid).values!.phase;
    const unwrapped = projectWithWrap(false).sweep(grid).values!.phase;
    expect(Math.min(...wrapped)).toBeGreaterThanOrEqual(-Math.PI - 1e-9);
    expect(Math.max(...wrapped)).toBeLessThanOrEqual(Math.PI + 1e-9);
    expect(Math.max(...unwrapped.map(Math.abs))).toBeGreaterThan(Math.PI);
  });

  it('is saved in the project and read back', () => {
    const p = projectWithWrap(false);
    const back = OpenISDProject.fromOwprText(p.toOwprText(), createEngine());
    if (Array.isArray(back)) throw new Error('fromOwprText returned problems: ' + back.join(', '));
    expect(back.winisdWrapPhase.value).toBe(false);
  });

  it('is reset to true by applyWinisdSettings()', () => {
    const p = projectWithWrap(false);
    expect(p.winisdWrapPhase.value).toBe(false);
    p.applyWinisdSettings();
    expect(p.winisdWrapPhase.value).toBe(true);
  });
});
