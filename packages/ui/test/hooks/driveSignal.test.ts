import {describe, expect, it} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {OpenISDProject} from '@openisd/design';
import {createDriveSignal} from '../../src/hooks/driveSignal.js';

function createCompleteProject() {
  const engine = createEngine();
  const project = OpenISDProject.empty(engine);
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Qes.set(0.45);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  return {engine, project};
}

describe('driveSignal', () => {
  describe('createDriveSignal', () => {
    it('derives V = sqrt(P * (Re + Rs)) from the driver Re', () => {
      const {project} = createCompleteProject();
      project.driver.specs.Re_ohm.set(6);
      project.powerDrive_W.set(50);
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {driveV} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      expect(driveV.value).toBeCloseTo(Math.sqrt(50 * 6.1), 6);
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

    it('setting V commits P = V^2/(Re + Rs)', () => {
      const {project} = createCompleteProject();
      project.driver.specs.Re_ohm.set(6);
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {driveV} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      driveV.value = 12;
      expect(project.powerDrive_W.value).toBeCloseTo((12 * 12) / 6.1, 6);
    });

    it('pre: Re 6, P 10 E, V √61 C | trigger: commit V 9, then commit blank V | post: P 81/6.1 C, V 9 E; then P 1 E, V √6.1 C', () => {
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
      expect(project.powerDrive_W.value).toBeCloseTo((9 * 9) / 6.1, 6);
      expect(project.powerDrive_W.calculated).toBe(true);
      expect(project.driveVoltage_V.entered).toBe(true);

      reconcileDriveV(null);
      expect(project.powerDrive_W.value).toBe(1);
      expect(project.powerDrive_W.entered).toBe(true);
      expect(project.driveVoltage_V.value).toBeCloseTo(Math.sqrt(6.1), 6);
      expect(project.driveVoltage_V.calculated).toBe(true);
    });

    it('rsOhm reads and writes Rs_ohm directly, defaulting a null write to 0', () => {
      const {project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const projectChanged = ref(0);

      const {rsOhm} = createDriveSignal({
        project: computed(() => projectRef.value),
        projectChanged,
      });

      expect(rsOhm.value).toBe(project.Rs_ohm.value);
      rsOhm.value = 0.5;
      expect(project.Rs_ohm.value).toBe(0.5);
      rsOhm.value = null as unknown as number;
      expect(project.Rs_ohm.value).toBe(0);
    });
  });
});
