import {describe, expect, it} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {Engine, type BoxType} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import {
  airFieldDataQuality,
  BAD_VOLUME_NOTE,
  createBoxVolume,
  createDriveSignal,
  createEnvironmentAir,
  createSealedReadouts,
  dqOfCell,
  dqOfEntry,
  dqOfSolved,
  fillBlankMeta,
  isBadVolume,
  isTabId,
  volumeDqNote,
} from '../../src/hooks/OriginalShell-hooks.js';

function createCompleteProject() {
  const engine = new Engine();
  const project = OpenISDProject.empty(engine);
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

  describe('createSealedReadouts', () => {
    it('computes positive rearResonance and rearQtc when box is sealed', () => {
      const {engine, project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('sealed');
      const projectChanged = ref(0);

      const readouts = createSealedReadouts({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
        engine,
      });

      expect(readouts.rearResonance.value).toBeGreaterThan(0);
      expect(readouts.rearQtc.value).toBeGreaterThan(0);
      expect(readouts.boxResonance.value).toBe(readouts.rearResonance.value);
    });

    it('returns null for rearQtc when box is vented', () => {
      const {engine, project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('vented');
      const projectChanged = ref(0);

      const readouts = createSealedReadouts({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
        engine,
      });

      expect(readouts.rearQtc.value).toBeNull();
      expect(readouts.rearResonance.value).toBeGreaterThan(0);
    });

    it('recomputes rearResonance when volume changes and projectChanged fires', () => {
      const {engine, project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('sealed');
      const projectChanged = ref(0);

      const readouts = createSealedReadouts({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
        engine,
      });

      const initialResonance = readouts.rearResonance.value;
      expect(initialResonance).toBeGreaterThan(0);

      // Halve the box volume -> resonance should increase
      project.box.sealed.volume_m3.set(0.006);
      projectChanged.value++;

      const newResonance = readouts.rearResonance.value;
      expect(newResonance).toBeGreaterThan(initialResonance!);
    });
  });

  describe('createBoxVolume', () => {
    const boxTypes: BoxType[] = ['sealed', 'vented', 'bandpass4', 'bandpass6', 'abc', 'box-passive-radiator'];

    it.each(boxTypes)('writes and reads back the %s box volume', (boxType) => {
      const {project} = createCompleteProject();
      project.box.boxType.set(boxType);
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>(boxType);
      const projectChanged = ref(0);

      const {boxVolume_m3, setBoxVolume_m3} = createBoxVolume({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
      });

      setBoxVolume_m3(0.02);
      expect(boxVolume_m3.value).toBeCloseTo(0.02, 9);
    });

    it('keeps full precision across write and read', () => {
      const {project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('sealed');
      const projectChanged = ref(0);

      const {boxVolume_m3, setBoxVolume_m3} = createBoxVolume({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
      });

      setBoxVolume_m3(0.012345678);
      expect(boxVolume_m3.value).toBeCloseTo(0.012345678, 12);
    });

    it('keeps a zero-or-less volume as entered and reports it via boxVolumeDqNote, never coerced', () => {
      const {project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('sealed');
      const projectChanged = ref(0);

      const {boxVolume_m3, setBoxVolume_m3, boxVolumeDqNote} = createBoxVolume({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
      });

      setBoxVolume_m3(0);
      projectChanged.value++;
      expect(boxVolume_m3.value).toBe(0);
      expect(boxVolumeDqNote.value).toBe(BAD_VOLUME_NOTE);

      setBoxVolume_m3(-1);
      projectChanged.value++;
      expect(boxVolume_m3.value).toBe(-1);
      expect(boxVolumeDqNote.value).toBe(BAD_VOLUME_NOTE);

      setBoxVolume_m3(0.02);
      projectChanged.value++;
      expect(boxVolumeDqNote.value).toBe('');
    });
  });

  describe('isBadVolume / volumeDqNote', () => {
    it('is false/empty for a positive volume', () => {
      expect(isBadVolume(0.02)).toBe(false);
      expect(volumeDqNote(0.02)).toBe('');
    });

    it('is true/the note for zero or a negative volume', () => {
      expect(isBadVolume(0)).toBe(true);
      expect(isBadVolume(-1)).toBe(true);
      expect(volumeDqNote(0)).toBe(BAD_VOLUME_NOTE);
      expect(volumeDqNote(-1)).toBe(BAD_VOLUME_NOTE);
    });
  });

  describe('createDriveSignal', () => {
    it('derives V = sqrt(P * Re) from the driver Re', () => {
      const {project} = createCompleteProject();
      project.driver.specs.Re_ohm.set(6);
      project.powerDrive_W.set(50);
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {driveV} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      expect(driveV.value).toBeCloseTo(Math.sqrt(50 * 6), 6);
    });

    it('pre: Re none, new project — P N, V 1 C | read | post: driveV 1, P locked, P dq names Re_ohm', () => {
      const {project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {driveV, powerLocked} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      expect(driveV.value).toBe(1);
      expect(project.driveVoltage_V.calculated).toBe(true);
      expect(project.powerDrive_W.value).toBeNull();
      expect(powerLocked.value).toBe(true);
      const dq = project.powerDrive_W.dq[0];
      expect(dq).toMatchObject({kind: 'missing-dependencies', target: 'power_W'});
      if (dq.kind === 'missing-dependencies') {
        expect(dq.routes[0].missing).toContain('Re_ohm');
      }
    });

    it('pre: Re none — P N, V 1 C | trigger: type V 12 | post: V 12 E, P N, P still locked', () => {
      const {project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {driveV, reconcileDriveV, powerLocked} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      driveV.value = 12;
      reconcileDriveV(12);
      expect(project.driveVoltage_V.value).toBe(12);
      expect(project.driveVoltage_V.entered).toBe(true);
      expect(project.powerDrive_W.value).toBeNull();
      expect(powerLocked.value).toBe(true);
    });

    it('pre: Re 6 — P 1 E | read | post: P unlocked', () => {
      const {project} = createCompleteProject();
      project.driver.specs.Re_ohm.set(6);
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {powerLocked} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      expect(project.powerDrive_W.value).toBe(1);
      expect(project.powerDrive_W.entered).toBe(true);
      expect(powerLocked.value).toBe(false);
    });

    it('setting V commits P = V^2/Re', () => {
      const {project} = createCompleteProject();
      project.driver.specs.Re_ohm.set(6);
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {driveV} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      driveV.value = 12;
      expect(project.powerDrive_W.value).toBeCloseTo((12 * 12) / 6, 6);
    });

    it('pre: Re 6, P 10 E, V √60 C | trigger: commit V 9, then commit blank V | post: P 81/6 C, V 9 E; then P 1 E, V √6 C', () => {
      const {project} = createCompleteProject();
      project.driver.specs.Re_ohm.set(6);
      project.powerDrive_W.set(10);
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {reconcileDriveV} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      reconcileDriveV(9);
      expect(project.powerDrive_W.value).toBeCloseTo((9 * 9) / 6, 6);
      expect(project.powerDrive_W.calculated).toBe(true);
      expect(project.driveVoltage_V.entered).toBe(true);

      reconcileDriveV(null);
      expect(project.powerDrive_W.value).toBe(1);
      expect(project.powerDrive_W.entered).toBe(true);
      expect(project.driveVoltage_V.value).toBeCloseTo(Math.sqrt(6), 6);
      expect(project.driveVoltage_V.calculated).toBe(true);
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
        }),
      };
    }

    it('is not stored and reads the calculated default until a value is entered', () => {
      const {project} = createCompleteProject();
      const {tick, envTempStored, advTemp, envTempDq} = harness(project);

      expect(envTempStored.value).toBe(false);
      expect(advTemp.value).not.toBeNull();
      expect(envTempDq.value).toEqual({dq: [], dqState: expect.any(String)});

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

    it('commitAirTemp/Humidity/Pressure clear the stored value once it reads back null — never re-seed the app default as entered', () => {
      const {project} = createCompleteProject();
      const {commitAirTemp, commitAirHumidity, commitAirPressure, envTempStored, envHumidityStored, envPressureStored} = harness(project);

      project.envTempK.set(300);
      project.envHumidityPct.set(50);
      project.envPressurePa.set(100000);
      project.envTempK.clear();     // simulates NumInput driving the cell to null via blank text
      project.envHumidityPct.clear();
      project.envPressurePa.clear();

      commitAirTemp();
      commitAirHumidity();
      commitAirPressure();

      expect(envTempStored.value).toBe(false);
      expect(envHumidityStored.value).toBe(false);
      expect(envPressureStored.value).toBe(false);
    });

    it('commitAirTemp is a no-op while a value is still entered', () => {
      const {project} = createCompleteProject();
      const {commitAirTemp} = harness(project);

      project.envTempK.set(305);
      commitAirTemp();
      expect(project.envTempK.value).toBe(305);
      expect(project.envTempK.entered).toBe(true);
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

    it('advAir follows the useWinisdAirModel flag through to the engine', () => {
      const {project} = createCompleteProject();
      const {tick, advAir} = harness(project);

      project.envUseWinisdAirModel.set(false);
      tick();
      const withoutWinisd = advAir.value;
      project.envUseWinisdAirModel.set(true);
      tick();
      const withWinisd = advAir.value;

      expect(withWinisd).not.toEqual(withoutWinisd);
    });
  });

  /**
   * The tab rail's closed set. `isTabId` is what a persisted tab id is parsed through on the way
   * back out of storage, so an id the app no longer has must not survive a reload as an active
   * tab — and `settings`, which is NOT a project's tab, must.
   */
  describe('dqOfEntry — the readout for a field that is entered or absent, never calculated', () => {
    it('E while a value is entered, N once cleared; dq passes through', () => {
      const {engine, project} = createCompleteProject();
      const width = project.box.vented.vent.width_m;
      width.set(0.05);
      expect(dqOfEntry(engine, width)).toEqual({dq: [], dqState: 'E'});

      width.clear();
      expect(dqOfEntry(engine, width)).toEqual({dq: [], dqState: 'N'});
    });
  });

  describe('dqOfSolved — the readout for a field only a solver writes, never entered', () => {
    it('N while an input is missing, C once solved', () => {
      const engine = new Engine();
      const blank = OpenISDProject.empty(engine);
      expect(dqOfSolved(engine, blank.box.sealed.resonance_hz)).toEqual({dq: [], dqState: 'N'});

      const {project} = createCompleteProject();
      expect(dqOfSolved(engine, project.box.sealed.resonance_hz)).toEqual({dq: [], dqState: 'C'});
    });
  });

  describe('dqOfCell — the readout for drive power P and drive voltage V', () => {
    it('pre: Re none — P N, V 1 C | trigger: Re 8 | post: P 1 E, V √8 C', () => {
      const {engine, project} = createCompleteProject();
      expect(dqOfCell(engine, project.powerDrive_W).dqState).toBe('N');
      expect(dqOfCell(engine, project.powerDrive_W).dq[0]).toMatch(/Re_ohm/);
      expect(dqOfCell(engine, project.driveVoltage_V)).toEqual({dq: [], dqState: 'C'});

      project.driver.specs.Re_ohm.set(8);
      expect(dqOfCell(engine, project.powerDrive_W)).toEqual({dq: [], dqState: 'E'});
      expect(dqOfCell(engine, project.driveVoltage_V)).toEqual({dq: [], dqState: 'C'});
    });
  });

  describe('isTabId', () => {
    it('accepts every tab the rail shows', () => {
      for (const id of ['box', 'driver', 'enclosure', 'filters', 'signal', 'advanced', 'project']) {
        expect(isTabId(id)).toBe(true);
      }
    });

    it('rejects anything else, whatever its type — including the Settings tab the rail no longer has (moved to Options, 2026-09-24)', () => {
      for (const junk of ['', 'Box', 'setting', 'settings', 'settings ', null, undefined, 0, {}]) {
        expect(isTabId(junk)).toBe(false);
      }
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
