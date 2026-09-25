import {describe, expect, it} from 'vitest';
import {
  Engine, DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA, DEFAULT_VENTED_DESIGN_LIMITS,
} from '../engine/index.js';
import {OpenISDProject} from '../domain/openisdDomain.js';

describe('Phase 1: Environmental Axioms (Tasks 26-33)', () => {
  it('envTempK provides the brand pattern: calculated default, entered, cleared', () => {
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);

    // Initial unstated state reads the calculated default, never null
    expect(project.envTempK.value).toBe(DEFAULT_T_REF_K);
    expect(project.envTempK.entered).toBe(false);
    expect(project.envTempK.calculated).toBe(true);

    // Setting value
    project.envTempK.set(295.15);
    expect(project.envTempK.value).toBe(295.15);
    expect(project.envTempK.entered).toBe(true);
    expect(project.envTempK.calculated).toBe(false);

    // Backward compat alias
    project.setEnvTempK(300);
    expect(project.envTempK.value).toBe(300);

    // Clearing value lands the calculated default again
    project.envTempK.clear();
    expect(project.envTempK.value).toBe(DEFAULT_T_REF_K);
    expect(project.envTempK.entered).toBe(false);
    expect(project.envTempK.calculated).toBe(true);
  });

  it('envHumidityPct provides the brand pattern: calculated default, entered, cleared', () => {
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);

    expect(project.envHumidityPct.value).toBe(DEFAULT_RH_REF_PCT);
    expect(project.envHumidityPct.entered).toBe(false);
    expect(project.envHumidityPct.calculated).toBe(true);

    project.envHumidityPct.set(50);
    expect(project.envHumidityPct.value).toBe(50);
    expect(project.envHumidityPct.entered).toBe(true);
    expect(project.envHumidityPct.calculated).toBe(false);

    project.setEnvHumidityPct(65);
    expect(project.envHumidityPct.value).toBe(65);

    project.envHumidityPct.clear();
    expect(project.envHumidityPct.value).toBe(DEFAULT_RH_REF_PCT);
    expect(project.envHumidityPct.entered).toBe(false);
    expect(project.envHumidityPct.calculated).toBe(true);
  });

  it('envPressurePa provides the brand pattern: calculated default, entered, cleared', () => {
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);

    expect(project.envPressurePa.value).toBe(DEFAULT_P_REF_PA);
    expect(project.envPressurePa.entered).toBe(false);
    expect(project.envPressurePa.calculated).toBe(true);

    project.envPressurePa.set(100000);
    expect(project.envPressurePa.value).toBe(100000);
    expect(project.envPressurePa.entered).toBe(true);
    expect(project.envPressurePa.calculated).toBe(false);

    project.setEnvPressurePa(98000);
    expect(project.envPressurePa.value).toBe(98000);

    project.envPressurePa.clear();
    expect(project.envPressurePa.value).toBe(DEFAULT_P_REF_PA);
    expect(project.envPressurePa.entered).toBe(false);
    expect(project.envPressurePa.calculated).toBe(true);
  });

  // John, 2026-09-24: "simply no reason for these exceptions to the rule" — the three
  // environment quantities are record-backed like every other field, so the app's Options value
  // is STORED as a 'C' entry rather than substituted at read time
  // (bugs/BUG_20260924_defaulted-fields-are-neither-marked-nor-recorded.md).

  it('the environment trio is STORED as calculated entries, and an entered one as an E entry', () => {
    const project = OpenISDProject.empty(new Engine());

    const stored = JSON.parse(project.toOwprText()).saved.environment;
    expect(stored.temperature_K).toMatchObject({state: 'C', value: DEFAULT_T_REF_K});
    expect(stored.humidity_pct).toMatchObject({state: 'C', value: DEFAULT_RH_REF_PCT});
    expect(stored.pressure_Pa).toMatchObject({state: 'C', value: DEFAULT_P_REF_PA});

    project.envTempK.set(295.15);
    project.save();
    expect(JSON.parse(project.toOwprText()).saved.environment.temperature_K)
      .toMatchObject({state: 'E', value: 295.15});
  });

  it('a changed app default re-stamps an unstated environment, and leaves an entered one alone', () => {
    let defaults = {tempK: 293.15, humidityPct: 50, pressurePa: 101325};
    const project = OpenISDProject.empty(new Engine({
      ventedLimits: () => DEFAULT_VENTED_DESIGN_LIMITS,
      envDefaults: () => defaults,
    }));
    expect(project.envTempK.value).toBe(293.15);
    project.envHumidityPct.set(42);

    defaults = {tempK: 250, humidityPct: 10, pressurePa: 90000};
    project.appSettingsChanged();

    expect(project.envTempK.value).toBe(250);
    expect(project.envTempK.calculated).toBe(true);
    expect(project.envPressurePa.value).toBe(90000);
    expect(project.envHumidityPct.value).toBe(42);
    expect(project.envHumidityPct.entered).toBe(true);
  });

  it('envUseWinisdAirModel provides SimpleField<boolean> behavior defaulting to true', () => {
    const engine = new Engine();
    const project = OpenISDProject.empty(engine);

    // Default out-of-the-box matches WinISD (QO95)
    expect(project.envUseWinisdAirModel.value).toBe(true);

    // Setting false
    project.envUseWinisdAirModel.set(false);
    expect(project.envUseWinisdAirModel.value).toBe(false);

    // Backward compat alias
    project.setEnvUseWinisdAirModel(true);
    expect(project.envUseWinisdAirModel.value).toBe(true);
  });
});
