import {describe, expect, it, vi} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {createApp} from 'vue';
import {APP_LOGIC} from '../../src/logic/app.js';
import {FOCUSED_PROJECT} from '../../src/logic/focusedProjectContext.js';
import {SplashModalKey} from '../../src/hooks/SplashModal-hooks.js';
import {provideCloudSync} from '../../src/hooks/CloudSync-hooks.js';
import {createCloudUiStore, createMemoryStorage} from '@openisd/persistence';
import {DriverId, ProjectId} from '@openisd/design/cloud';
import {testAppLogic} from './testAppLogic.js';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder} from '@openisd/design';
import {
  createEnvironmentAir,
  fillBlankMeta,
  useOriginalShell,
} from '../../src/hooks/OriginalShell-hooks.js';

function createCompleteProject() {
  const engine = createEngine();
  const project = ProjectBuilder.empty(engine);
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Qes.set(0.45);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  return {engine, project};
}

describe('OriginalShell-hooks', () => {
  it('opens a project conflict as a project and a driver conflict in the driver browser', () => {
    const logic = testAppLogic();
    const project = ProjectBuilder.empty(logic.engine);
    project.driver.specs.Fs_hz.set(40);
    project.driver.specs.Qts.set(0.38);
    project.driver.specs.Qes.set(0.45);
    project.driver.specs.Vas_m3.set(0.03);
    project.box.sealed.volume_m3.set(0.012);
    logic.projectRepo.storeNew(project);
    const storedProjectId = logic.projectRepo.listStoredProjects()[0]!.id;
    const app = createApp({render: () => null});
    app.provide(APP_LOGIC, logic);
    app.provide(FOCUSED_PROJECT, computed(() => project));
    app.provide(SplashModalKey, {
      open: computed(() => false), driverCount: ref(null), passiveRadiatorCount: ref(null), versions: ref(null),
      dismiss: () => undefined, show: () => undefined,
    });
    provideCloudSync(app, null, createCloudUiStore(createMemoryStorage()));
    const shell = app.runWithContext(() => useOriginalShell());

    shell.handleCloudOpenConflict(ProjectId.of(storedProjectId)!);
    shell.handleCloudOpenConflict(DriverId.of('missing-driver')!);

    expect(shell.presentationState.browseOpen).toBe(true);
    const anchor = {href: '', download: '', click: vi.fn()};
    vi.stubGlobal('document', {createElement: vi.fn(() => anchor)});
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test');
    try {
      shell.exportProjectsArchive();
      expect(anchor.download).toMatch(/^openisd-projects-.*\.json$/);
      expect(anchor.href).toBe('blob:test');
      expect(anchor.click).toHaveBeenCalledOnce();
      expect(createObjectUrl).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    }
  });
;

  describe('createEnvironmentAir', () => {

    function harness(project: OpenISDProject) {
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);
      // `tick` stands in for the app's change counter, which bumps after every domain write.
      const tick = (): void => { projectChanged.value++; };
      return {
        tick,
        ...createEnvironmentAir({
          project: computed(() => projectRef.value),
          projectChanged,
        }),
      };
    }

    it('is stored (the app level copied in as entered) on a new project, and reads calculated once cleared', () => {
      const {project} = createCompleteProject();
      const {tick, envTempStored, advTemp, envTempDq} = harness(project);

      expect(envTempStored.value).toBe(true);
      project.envTempK.clear();
      tick();
      expect(envTempStored.value).toBe(false);
      expect(advTemp.value).not.toBeNull();
      expect(envTempDq.value.dq).toEqual([]);
      expect(envTempDq.value.dqState).toMatch(/^[ECN]$/);

      project.envTempK.set(310);
      tick();
      expect(envTempStored.value).toBe(true);
      expect(advTemp.value).toBe(310);
    });

    it('the same stored/calculated split holds for humidity and pressure', () => {
      const {project} = createCompleteProject();
      const {tick, envHumidityStored, advHumidity, envPressureStored, advPressure} = harness(project);

      expect(envHumidityStored.value).toBe(true);
      expect(envPressureStored.value).toBe(true);
      project.envHumidityPct.clear();
      project.envPressurePa.clear();
      tick();
      expect(envHumidityStored.value).toBe(false);
      expect(envPressureStored.value).toBe(false);

      project.envHumidityPct.set(60);
      project.envPressurePa.set(99000);
      tick();

      expect(envHumidityStored.value).toBe(true);
      expect(advHumidity.value).toBe(60);
      expect(envPressureStored.value).toBe(true);
      expect(advPressure.value).toBe(99000);
    });

    it('setting advTemp to a finite number enters it; a non-finite write clears it back to calculated', () => {
      const {project} = createCompleteProject();
      const {tick, advTemp, envTempStored} = harness(project);

      advTemp.value = 300;
      tick();
      expect(envTempStored.value).toBe(true);
      expect(project.envTempK.value).toBe(300);

      advTemp.value = null;
      tick();
      expect(envTempStored.value).toBe(false);
    });

    it('shows the field\'s own mark, with its reason, for a temperature the air model does not cover', () => {
      const {project} = createCompleteProject();
      const {tick, advTemp, envTempDq} = harness(project);

      advTemp.value = 5000;
      tick();
      expect(envTempDq.value.dq).toEqual(project.envTempK.dq.map(issue => issue.text));
      expect(envTempDq.value.dq.length).toBeGreaterThan(0);
    });

    it('shows a mark with the reason on a typed c the air cannot honour and on the temperature it could not solve', () => {
      const {project} = createCompleteProject();
      const {tick, advSoundVelocity, envSoundVelocityDq, envTempDq} = harness(project);

      project.clearAir();
      advSoundVelocity.value = 900;
      tick();
      expect(envSoundVelocityDq.value.dq.join(' ')).toContain('no temperature in range gives this c');
      expect(envTempDq.value.dq.join(' ')).toContain('no temperature in range gives this c');
      expect(envSoundVelocityDq.value.dqState).toBe('E');
    });

    it('clearing each air field text clears its entry and reads back as the app default, calculated', () => {
      const {project} = createCompleteProject();
      const {tick, advTemp, advHumidity, advPressure, envTempStored, envHumidityStored, envPressureStored} = harness(project);

      const appDefaults = {temp: advTemp.value, humidity: advHumidity.value, pressure: advPressure.value};
      advTemp.value = 300;
      advHumidity.value = 50;
      advPressure.value = 100000;
      advTemp.value = null;
      advHumidity.value = null;
      advPressure.value = null;
      tick();

      expect(envTempStored.value).toBe(false);
      expect(envHumidityStored.value).toBe(false);
      expect(envPressureStored.value).toBe(false);
      expect(advTemp.value).toBe(appDefaults.temp);
      expect(advHumidity.value).toBe(appDefaults.humidity);
      expect(advPressure.value).toBe(appDefaults.pressure);
    });

    it('resetAirToAppDefaults empties all five fields; the solver fills them from the app levels as calculated', () => {
      const {project} = createCompleteProject();
      const {resetAirToAppDefaults, tick, advTemp, advHumidity, advPressure, advAir, envTempStored} = harness(project);
      advTemp.value = 250;
      advHumidity.value = 90;
      advPressure.value = 90000;
      project.envC_m_per_s.set(330);
      tick();
      expect(envTempStored.value).toBe(true);

      resetAirToAppDefaults();
      tick();

      expect(advTemp.value).toBe(293.15);
      expect(envTempStored.value).toBe(false);
      expect(project.envC_m_per_s.entered).toBe(false);
      expect(project.envHumidityPct.calculated).toBe(true);
      expect(project.envPressurePa.calculated).toBe(true);
      expect(advAir.value.c).not.toBe(330);
    });

    it('advAir recomputes when the entered air fields change', () => {
      const {project} = createCompleteProject();
      const {tick, advAir, advTemp, advPressure} = harness(project);

      const before = advAir.value;
      advTemp.value = 250;
      advPressure.value = 90000;
      tick();
      const after = advAir.value;

      expect(after).not.toEqual(before);
    });
  });

  describe('fillBlankMeta', () => {
    function blankMetaProject() {
      const {project} = createCompleteProject();
      project.created.set('');
      project.modified.set('');
      project.creator.set('');
      return project;
    }

    it('stamps created/modified with the given date, in WinISD\'s YYYYMMDD format', () => {
      const project = blankMetaProject();

      const changed = fillBlankMeta(project, null, '20260304');

      expect(changed).toBe(true);
      expect(project.created.value).toBe('20260304');
      expect(project.modified.value).toBe('20260304');
    });

    it('stamps creator from the given username when known', () => {
      const project = blankMetaProject();

      fillBlankMeta(project, 'johnl', '20260304');

      expect(project.creator.value).toBe('johnl');
    });

    it('leaves creator blank — never a hardcoded fallback — when no username is known', () => {
      const project = blankMetaProject();

      const changed = fillBlankMeta(project, null, '20260304');

      expect(project.creator.value).toBe('');
      expect(changed).toBe(true);
    });

    it('reports no change, and touches nothing, once nothing is blank', () => {
      const {project} = createCompleteProject();
      project.creator.set('someone');

      const changed = fillBlankMeta(project, 'johnl', '20260304');

      expect(changed).toBe(false);
      expect(project.creator.value).toBe('someone');
    });
  });

  describe('frequency nudge buttons (startNudge)', () => {
    function shellOn(project: OpenISDProject) {
      const app = createApp({render: () => null});
      app.provide(APP_LOGIC, testAppLogic());
      app.provide(FOCUSED_PROJECT, computed(() => project));
      app.provide(SplashModalKey, {
        open: computed(() => false), driverCount: ref(null), passiveRadiatorCount: ref(null), versions: ref(null),
        dismiss: () => undefined, show: () => undefined,
      });
      provideCloudSync(app, null, createCloudUiStore(createMemoryStorage()));
      return app.runWithContext(() => useOriginalShell());
    }

    it('nudging up from a pinned frequency multiplies it by 1.02 and locks the cursor there', () => {
      const {project} = createCompleteProject();
      project.pinnedF.set(100);
      const shell = shellOn(project);
      shell.startNudge(1);
      shell.stopNudge();
      expect(project.pinnedF.value).toBeCloseTo(102, 10);
      expect(project.cursorF.value).toBeCloseTo(102, 10);
      expect(project.cursorLocked.value).toBe(true);
    });

    it('nudging down divides by 1.02', () => {
      const {project} = createCompleteProject();
      project.pinnedF.set(100);
      const shell = shellOn(project);
      shell.startNudge(-1);
      shell.stopNudge();
      expect(project.pinnedF.value).toBeCloseTo(100 / 1.02, 10);
    });

    it('nudging up with nothing pinned starts from the geometric mean of the axis', () => {
      const {project} = createCompleteProject();
      const shell = shellOn(project);
      shell.startNudge(1);
      shell.stopNudge();
      expect(project.pinnedF.value).toBeCloseTo(Math.sqrt(10 * 1000) * 1.02, 6);
    });
  });
});
