/**
 * T744: a driver copy leaving a project (the driver editor's working copy) keeps the project's context, its air, so the copy's
 * calculated Cms, Vas and c equal the project's. A driver that never was in a project (My Drivers, the catalogue) uses the app's air.
 * The two contexts are distinct types: passing the wrong one is a compile error.
 */
import {describe, expect, expectTypeOf, it} from 'vitest';
import type {Engine} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {OpenISDDriverStandalone} from '../../domain/driver/openISDDriver.js';
import {AppContext, ProjectContext} from '../../domain/driver/driverContext.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec} from '../fixtures/recordBuilders.js';

/** Vas stated, Cms not: the Cms the box shows is worked out in the driver's air. */
const DRIVER = {Fs_hz: 30, Qes: 0.4, Qms: 4, Re_ohm: 6.4, Sd_m2: 0.02, Vas_m3: 0.05, Xmax_m: 0.008, Pe_W: 100};
const HOT_K = 318.15;

function hotProject(engine: Engine) {
  const project = new ProjectBuilder(driverFromSpec(engine, DRIVER), engine).sealed().volume_m3(0.03).build();
  project.envTempK.set(HOT_K);
  return project;
}

describe('a driver copy leaving a project', () => {
  it("detach() copy reads the project's calculated Cms, Mms and c in non-default air", () => {
    const project = hotProject(createEngine());
    const copy = project.driver.detach().specs;
    for (const field of ['Cms_m_per_N', 'Mms_kg', 'c_m_per_s', 'roo_kg_per_m3'] as const) {
      const shown = project.driver.specs[field].value;
      expect(shown, field).not.toBeNull();
      expect(copy[field].value, field).toBe(shown);
    }
  });

  it('a managed driver (built standalone) uses the app air, not an open project\'s', () => {
    const engine = createEngine();
    const hot = hotProject(engine).driver.specs;
    const alone = driverFromSpec(engine, DRIVER).specs;
    expect(alone.c_m_per_s.value).not.toBe(hot.c_m_per_s.value);
  });
});

describe('the wrong context is a compile error', () => {
  it('a managed context is not a project context, and the reverse', () => {
    expectTypeOf<AppContext>().not.toExtend<ProjectContext>();
    expectTypeOf<ProjectContext>().not.toExtend<AppContext>();
  });

  it('each wrap takes only its own kind of context', () => {
    expectTypeOf(OpenISDDriverStandalone.wrap).parameters.toEqualTypeOf<[Parameters<typeof OpenISDDriverStandalone.wrap>[0], Engine, AppContext]>();
    expectTypeOf(OpenISDDriverStandalone.wrapProjectCopy).parameters.toEqualTypeOf<[Parameters<typeof OpenISDDriverStandalone.wrap>[0], Engine, ProjectContext]>();
  });
});
