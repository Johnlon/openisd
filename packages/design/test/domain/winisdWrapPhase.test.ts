import { describe, it, expect } from 'vitest';
import { createEngine, ProjectBuilder } from '../../domain/index.js';
import { driverFromSpec } from '../fixtures/recordBuilders.js';

const W5 = { Fs_hz: 45, Re_ohm: 3.4, Qes: 0.57, Qms: 3.56, Vas_m3: 0.00485, Sd_m2: 0.0094, Pe_W: 40 };

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

  it('toggles phase wrapping in sweep results', () => {
    const wrappedProj = projectWithWrap(true);
    const unwrappedProj = projectWithWrap(false);

    const swWrapped = wrappedProj.sweep({ fmin: 1, fmax: 200, N: 100 });
    const swUnwrapped = unwrappedProj.sweep({ fmin: 1, fmax: 200, N: 100 });

    if (!swWrapped.values) console.log('Wrapped issues:', swWrapped.issues);

    expect(swWrapped.values).not.toBeNull();
    expect(swUnwrapped.values).not.toBeNull();

    // When wrapped (default), all phase values stay within [-PI, +PI]
    for (const ph of swWrapped.values!.phase) {
      expect(ph).toBeGreaterThanOrEqual(-Math.PI - 1e-9);
      expect(ph).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });

  it('is reset to true by applyWinisdSettings()', () => {
    const p = projectWithWrap(false);
    expect(p.winisdWrapPhase.value).toBe(false);
    p.applyWinisdSettings();
    expect(p.winisdWrapPhase.value).toBe(true);
  });
});
