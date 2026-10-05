import {describe, expect, it} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject, ProjectBuilder} from '@openisd/design';
import {
  airFieldDataQuality,
  createEnvironmentAir,
  fillBlankMeta,
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
  describe('airFieldDataQuality', () => {
    it('returns empty array when value is null', () => {
      expect(airFieldDataQuality('temperature', null)).toEqual([]);
      expect(airFieldDataQuality('humidity', null)).toEqual([]);
      expect(airFieldDataQuality('pressure', null)).toEqual([]);
    });

    it('validates temperature limits (0–400)', () => {
      expect(airFieldDataQuality('temperature', 293.15)).toEqual([]);
      expect(airFieldDataQuality('temperature', -5)).toEqual([
        'Temperature is outside the sane range (0–400)',
      ]);
      expect(airFieldDataQuality('temperature', 500)).toEqual([
        'Temperature is outside the sane range (0–400)',
      ]);
    });

    it('validates relative humidity limits (0–100)', () => {
      expect(airFieldDataQuality('humidity', 50)).toEqual([]);
      expect(airFieldDataQuality('humidity', -1)).toEqual([
        'Relative humidity is outside the sane range (0–100)',
      ]);
      expect(airFieldDataQuality('humidity', 101)).toEqual([
        'Relative humidity is outside the sane range (0–100)',
      ]);
    });

    it('validates air pressure limits (1000–200000)', () => {
      expect(airFieldDataQuality('pressure', 101325)).toEqual([]);
      expect(airFieldDataQuality('pressure', 500)).toEqual([
        'Air pressure is outside the sane range (1000–200000)',
      ]);
      expect(airFieldDataQuality('pressure', 250000)).toEqual([
        'Air pressure is outside the sane range (1000–200000)',
      ]);
    });
  });

  describe('createEnvironmentAir', () => {
    const STUB_DEFAULTS = {tempK: 293.15, humidityPct: 45, pressurePa: 101325};

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
          envDefaults: () => STUB_DEFAULTS,
          environment: createEngine().environment,
        }),
      };
    }

    it('is not stored and reads the calculated default until a value is entered', () => {
      const {project} = createCompleteProject();
      const {tick, envTempStored, advTemp, envTempDq} = harness(project);

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

    it('flags a temperature outside 0-400K via envTempDq, same rule as airFieldDataQuality', () => {
      const {project} = createCompleteProject();
      const {advTemp, envTempDq} = harness(project);

      advTemp.value = 500;
      expect(envTempDq.value.dq).toEqual(airFieldDataQuality('temperature', 500));
      expect(envTempDq.value.dq.length).toBeGreaterThan(0);
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

    it('resetAirToAppDefaults enters all three fields from the injected envDefaults()', () => {
      const {project} = createCompleteProject();
      const {resetAirToAppDefaults, advTemp, advHumidity, advPressure, envTempStored} = harness(project);

      resetAirToAppDefaults();

      expect(advTemp.value).toBe(STUB_DEFAULTS.tempK);
      expect(advHumidity.value).toBe(STUB_DEFAULTS.humidityPct);
      expect(advPressure.value).toBe(STUB_DEFAULTS.pressurePa);
      expect(envTempStored.value).toBe(true);
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
});
