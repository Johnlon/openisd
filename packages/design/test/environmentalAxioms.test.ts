import {describe, expect, it} from 'vitest';
import {
  createEngine, DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA, DEFAULT_VENTED_DESIGN_LIMITS,
} from '../engine/index.js';
import {ProjectBuilder} from '../domain/openisdTransforms.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Narrows a `JSON.parse(...)` result's `saved.environment` section — the runtime check the
 *  value needs before its fields can be read; this file reads `.owpr` JSON only through this,
 *  never through a cast. */
function savedEnvironment(owprText: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(owprText);
  if (!isRecord(parsed)) throw new Error('expected an object');
  const saved = parsed.saved;
  if (!isRecord(saved)) throw new Error('expected saved to be an object');
  const environment = saved.environment;
  if (!isRecord(environment)) throw new Error('expected saved.environment to be an object');
  return environment;
}

describe('Phase 1: Environmental Axioms (Tasks 26-33)', () => {
  it('envTempK provides the brand pattern: calculated default, entered, cleared', () => {
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);

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
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);

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
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);

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
    const project = ProjectBuilder.empty(createEngine());

    const stored = savedEnvironment(project.toOwprText());
    expect(stored.temperature_K).toMatchObject({state: 'C', value: DEFAULT_T_REF_K});
    expect(stored.humidity_pct).toMatchObject({state: 'C', value: DEFAULT_RH_REF_PCT});
    expect(stored.pressure_Pa).toMatchObject({state: 'C', value: DEFAULT_P_REF_PA});

    project.envTempK.set(295.15);
    project.save();
    expect(savedEnvironment(project.toOwprText()).temperature_K)
      .toMatchObject({state: 'E', value: 295.15});
  });

  it('a changed app default re-stamps an unstated environment, and leaves an entered one alone', () => {
    let defaults = {tempK: 293.15, humidityPct: 50, pressurePa: 101325};
    const project = ProjectBuilder.empty(createEngine({
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
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);

    // Default out-of-the-box matches WinISD (QO95)
    expect(project.envUseWinisdAirModel.value).toBe(true);

    // Setting false
    project.envUseWinisdAirModel.set(false);
    expect(project.envUseWinisdAirModel.value).toBe(false);

    // Backward compat alias
    project.setEnvUseWinisdAirModel(true);
    expect(project.envUseWinisdAirModel.value).toBe(true);
  });

  it('the embedded driver resolves air the same way the project/sweep does, with useWinisdAirModel unset (BUG_20260924)', () => {
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);

    // Away from reference conditions, so the physical and WinISD air models diverge visibly —
    // and envUseWinisdAirModel is left UNSET (defaults to true, QO95), so both sides must apply
    // the same default.
    project.envTempK.set(250);
    project.envHumidityPct.set(80);
    project.envPressurePa.set(90000);

    const expected = engine.environment.solve({
      tempK: 250, humidityPct: 80, pressurePa: 90000, useWinisdAirModel: true,
    }).values;

    expect(project.driver.specs.c_m_per_s.value).toBeCloseTo(expected.c, 9);
    expect(project.driver.specs.roo_kg_per_m3.value).toBeCloseTo(expected.rho, 9);
  });
});
