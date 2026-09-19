import {describe, expect, it} from 'vitest';
import {Engine} from '../engine/index.js';
import {OpenISDProject} from '../domain/openisdDomain.js';

describe('Phase 1: Environmental Axioms (Tasks 26-33)', () => {
  it('envTempK provides Field<number> behavior with Cell state', () => {
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);

    // Initial unstated state
    expect(project.envTempK.value).toBeNull();
    expect(project.envTempK.get().state).toBe('not-available');

    // Setting value
    project.envTempK.set(295.15);
    expect(project.envTempK.value).toBe(295.15);
    expect(project.envTempK.get().state).toBe('entered');

    // Backward compat alias
    project.setEnvTempK(300);
    expect(project.envTempK.value).toBe(300);

    // Clearing value
    project.envTempK.clear();
    expect(project.envTempK.value).toBeNull();
    expect(project.envTempK.get().state).toBe('not-available');
  });

  it('envHumidityPct provides Field<number> behavior with Cell state', () => {
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);

    // Initial unstated state
    expect(project.envHumidityPct.value).toBeNull();
    expect(project.envHumidityPct.get().state).toBe('not-available');

    // Setting value
    project.envHumidityPct.set(50);
    expect(project.envHumidityPct.value).toBe(50);
    expect(project.envHumidityPct.get().state).toBe('entered');

    // Backward compat alias
    project.setEnvHumidityPct(65);
    expect(project.envHumidityPct.value).toBe(65);

    // Clearing value
    project.envHumidityPct.clear();
    expect(project.envHumidityPct.value).toBeNull();
    expect(project.envHumidityPct.get().state).toBe('not-available');
  });

  it('envPressurePa provides Field<number> behavior with Cell state', () => {
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);

    // Initial unstated state
    expect(project.envPressurePa.value).toBeNull();
    expect(project.envPressurePa.get().state).toBe('not-available');

    // Setting value
    project.envPressurePa.set(101325);
    expect(project.envPressurePa.value).toBe(101325);
    expect(project.envPressurePa.get().state).toBe('entered');

    // Backward compat alias
    project.setEnvPressurePa(100000);
    expect(project.envPressurePa.value).toBe(100000);

    // Clearing value
    project.envPressurePa.clear();
    expect(project.envPressurePa.value).toBeNull();
    expect(project.envPressurePa.get().state).toBe('not-available');
  });

  it('envUseWinisdAirModel provides RawField<boolean> behavior defaulting to true', () => {
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);

    // Default out-of-the-box matches WinISD (QO95)
    expect(project.envUseWinisdAirModel.get()).toBe(true);

    // Setting false
    project.envUseWinisdAirModel.set(false);
    expect(project.envUseWinisdAirModel.get()).toBe(false);

    // Backward compat alias
    project.setEnvUseWinisdAirModel(true);
    expect(project.envUseWinisdAirModel.get()).toBe(true);
  });
});
