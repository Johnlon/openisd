import {describe, expect, it} from 'vitest';
import {DEFAULT_T_REF_K, DEFAULT_RH_REF_PCT, DEFAULT_P_REF_PA} from '../../engine/air.js';
import {createEngine} from '../../engine/Engine.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {OpenISDProject} from '../../domain/project/openISDProject.js';

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

describe('Phase 1: Environmental Axioms', () => {
  it('envTempK, envHumidityPct and envPressurePa are entered on a new project, and a clear leaves them calculated from the app', () => {
    const project = ProjectBuilder.empty(createEngine());
    for (const [field, app] of [[project.envTempK, DEFAULT_T_REF_K], [project.envHumidityPct, DEFAULT_RH_REF_PCT], [project.envPressurePa, DEFAULT_P_REF_PA]] as const) {
      expect(field.value).toBe(app);
      expect(field.entered).toBe(true);
      field.set(app + 1);
      expect(field.value).toBe(app + 1);
      field.clear();
      expect(field.value).toBe(app);
      expect(field.entered).toBe(false);
      expect(field.calculated).toBe(true);
    }
  });

  it('a new project stores T, RH and p as entered entries and c and rho as calculated ones', () => {
    const project = ProjectBuilder.empty(createEngine());
    const stored = savedEnvironment(project.toOwprText());
    expect(stored.temperature_K).toMatchObject({state: 'E', value: DEFAULT_T_REF_K});
    expect(stored.humidity_pct).toMatchObject({state: 'E', value: DEFAULT_RH_REF_PCT});
    expect(stored.pressure_Pa).toMatchObject({state: 'E', value: DEFAULT_P_REF_PA});
    expect(stored.c_m_per_s).toMatchObject({state: 'C'});
    expect(stored.roo_kg_per_m3).toMatchObject({state: 'C'});
  });

  it('a project saved with the removed useWinisdAirModel key (true, false or null) opens, the key ignored', () => {
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);
    project.envTempK.set(250);
    const text = project.toOwprText();
    expect(text).not.toContain('useWinisdAirModel');
    for (const legacy of ['true', 'false', 'null']) {
      const old = text.replaceAll('"environment": {', `"environment": {"useWinisdAirModel": ${legacy},`);
      expect(old).toContain('useWinisdAirModel');
      const back = OpenISDProject.fromOwprText(old, engine);
      if (Array.isArray(back)) throw new Error(`fromOwprText returned problems for ${legacy}: ` + back.join(', '));
      expect(back.envTempK.value).toBe(250);
      expect(back.toOwprText()).not.toContain('useWinisdAirModel');
    }
  });

  // Regression for bugs/archive/BUG_20260924*.md
  it('the embedded driver resolves air the same way the project/sweep does', () => {
    const engine = createEngine();
    const project = ProjectBuilder.empty(engine);

    // Away from reference conditions, so a driver left on reference air would differ visibly.
    project.envTempK.set(250);
    project.envHumidityPct.set(80);
    project.envPressurePa.set(90000);

    const expected = engine.environment.solve({
      tempK: 250, humidityPct: 80, pressurePa: 90000,
    }).values;

    expect(project.driver.specs.c_m_per_s.value).toBeCloseTo(expected.c, 9);
    expect(project.driver.specs.roo_kg_per_m3.value).toBeCloseTo(expected.rho, 9);
  });
});
