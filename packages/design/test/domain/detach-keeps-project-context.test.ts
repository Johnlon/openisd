/**
 * T744: every way a driver or radiator copy leaves a project keeps the project's context (its air and its
 * "Cms from Vas" choice), so the copy's Cms, Vas and Mms equal the project's. A driver or radiator that never
 * was in a project (My Drivers, the catalogue) uses the app's air and shows its datasheet.
 */
import {describe, expect, expectTypeOf, it} from 'vitest';
import type {Engine} from '../../engine/index.js';
import {createEngine} from '../../engine/index.js';
import {CompatSwitch} from '../../domain/project/compatSwitch.js';
import {OpenISDDriverStandalone} from '../../domain/driver/openISDDriver.js';
import {OpenISDPassiveRadiatorStandalone} from '../../domain/passiveRadiator/openISDPassiveRadiatorStandalone.js';
import {AppContext, ProjectContext} from '../../domain/driver/driverContext.js';
import {RadiatorAppContext, RadiatorProjectContext} from '../../domain/passiveRadiator/radiatorContext.js';
import {ProjectBuilder} from '../../domain/openisdTransforms.js';
import {driverFromSpec, radiatorFromSpec} from '../fixtures/recordBuilders.js';

const DRIVER = {Fs_hz: 30, Qes: 0.4, Qms: 4, Re_ohm: 6.4, Sd_m2: 0.02, BL_Tm: 8, Mms_kg: 0.05, Xmax_m: 0.008, Pe_W: 100};
const RADIATOR = {Fs_hz: 30, Qms: 3.3, Sd_m2: 0.0095};
const HOT_K = 318.15;
const FIGURES = ['Cms_m_per_N', 'Vas_m3', 'Mms_kg'] as const;

/** A P173-style pair: the datasheet states a Cms that disagrees with its Vas. Vas-only gives a figure that depends on the air. */
const vasOnly = (kind: 'driver' | 'radiator') => ({Vas_m3: kind === 'driver' ? 0.05 : 0.0048});
const disagreeing = (kind: 'driver' | 'radiator', cms: number) => ({...vasOnly(kind), Cms_m_per_N: cms});

function projectOf(engine: Engine, kind: 'driver' | 'radiator', stated: Record<string, number>) {
  const project = new ProjectBuilder(driverFromSpec(engine, kind === 'driver' ? {...DRIVER, ...stated} : {...DRIVER, Vas_m3: 0.05}), engine).sealed().volume_m3(0.03).build();
  if (kind === 'radiator') {
    project.box.boxType.set('box-passive-radiator');
    project.box.passiveRadiator.configurePR(radiatorFromSpec(engine, {...RADIATOR, ...stated}));
    project.box.passiveRadiator.count.set(1);
  }
  project.envTempK.set(HOT_K);
  return project;
}

const specOf = (project: ReturnType<typeof projectOf>, kind: 'driver' | 'radiator') =>
  kind === 'driver' ? project.driver.specs : project.box.passiveRadiator.radiator.spec;

describe.each(['driver', 'radiator'] as const)('a %s copy leaving a project', (kind) => {
  for (const ticked of [true, false]) {
    it(`detach() copy reads the project's Cms, Vas and Mms (Cms from Vas ${ticked ? 'ticked' : 'unticked'}, non-default air)`, () => {
      const engine = createEngine();
      const base = kind === 'driver' ? 0.0005 : 0.0009;
      const project = projectOf(engine, kind, disagreeing(kind, base));
      CompatSwitch.CMS_FROM_VAS.of(project).set(ticked);
      const copy = kind === 'driver' ? project.driver.detach().specs : project.box.passiveRadiator.radiator.detach().spec;
      for (const field of FIGURES) {
        const shown = specOf(project, kind)[field].value;
        expect(shown, field).not.toBeNull();
        expect(copy[field].value, field).toBe(shown);
      }
    });
  }

  it('a managed one (built standalone) edited while a project with non-default air is open uses the app air and shows its datasheet', () => {
    const engine = createEngine();
    const stated = disagreeing(kind, kind === 'driver' ? 0.0005 : 0.0009);
    const project = projectOf(engine, kind, stated);
    const managed = kind === 'driver' ? driverFromSpec(engine, {...DRIVER, ...stated}).specs : radiatorFromSpec(engine, {...RADIATOR, ...stated}).spec;
    // The standalone rule: the datasheet's own Cms, whichever the project's switch says.
    expect(managed.Cms_m_per_N.value).toBe(stated.Cms_m_per_N);
    expect(managed.Cms_m_per_N.value).not.toBe(specOf(project, kind).Cms_m_per_N.value);
    // The app's air (the driver's c and roo show it; a radiator is resolved in an air its caller names).
    if (kind === 'driver') {
      const hot = project.driver.specs;
      const alone = driverFromSpec(engine, {...DRIVER, ...stated}).specs;
      const appAir = projectOf(engine, kind, stated);
      appAir.envTempK.set(engine.environment.appAir.temperature());
      for (const field of ['c_m_per_s', 'roo_kg_per_m3'] as const) {
        expect(alone[field].value, field).toBe(appAir.driver.specs[field].value);
        expect(alone[field].value, field).not.toBe(hot[field].value);
      }
    }
  });
});

describe('the wrong context is a compile error', () => {
  it('a managed context is not a project context, and the reverse (driver and radiator)', () => {
    expectTypeOf<AppContext>().not.toExtend<ProjectContext>();
    expectTypeOf<ProjectContext>().not.toExtend<AppContext>();
    expectTypeOf<RadiatorAppContext>().not.toExtend<RadiatorProjectContext>();
    expectTypeOf<RadiatorProjectContext>().not.toExtend<RadiatorAppContext>();
  });

  it('each wrap takes only its own kind of context', () => {
    expectTypeOf(OpenISDDriverStandalone.wrap).parameters.toEqualTypeOf<[Parameters<typeof OpenISDDriverStandalone.wrap>[0], Engine, AppContext]>();
    expectTypeOf(OpenISDDriverStandalone.wrapProjectCopy).parameters.toEqualTypeOf<[Parameters<typeof OpenISDDriverStandalone.wrap>[0], Engine, ProjectContext]>();
    expectTypeOf(OpenISDPassiveRadiatorStandalone.wrapProjectCopy).parameters.toEqualTypeOf<[Parameters<typeof OpenISDPassiveRadiatorStandalone.wrap>[0], RadiatorProjectContext]>();
    expectTypeOf(OpenISDPassiveRadiatorStandalone.wrap).parameters.toEqualTypeOf<[Parameters<typeof OpenISDPassiveRadiatorStandalone.wrap>[0]]>();
  });
});
