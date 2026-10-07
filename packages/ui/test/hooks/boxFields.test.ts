import {describe, expect, it} from 'vitest';
import {computed, nextTick, ref, shallowRef} from 'vue';
import {createEngine, type BoxType} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {
  createBoxLosses,
  createBoxVolume,
  createSealedReadouts,
  createSelectedBox,
} from '../../src/hooks/boxFields.js';

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

describe('boxFields', () => {
  describe('createSealedReadouts', () => {
    it('computes positive rearResonance and rearQtc when box is sealed', () => {
      const {project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('sealed');
      const projectChanged = ref(0);

      const readouts = createSealedReadouts({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
      });

      expect(readouts.rearResonance.value).toBeGreaterThan(0);
      expect(readouts.rearQtc.value).toBeGreaterThan(0);
      expect(readouts.boxResonance.value).toBe(readouts.rearResonance.value);
    });

    it('reads the bandpass4 rear chamber for Frc and Qtc, not the dormant sealed box', () => {
      const {project} = createCompleteProject();
      project.box.bandpass4.chambers.rear.volume_m3.set(0.02);
      const projectRef = shallowRef(project);

      const readouts = createSealedReadouts({
        project: computed(() => projectRef.value),
        selectedBox: ref<BoxType>('bandpass4'),
        projectChanged: ref(0),
      });

      expect(readouts.rearResonance.value).toBe(project.box.bandpass4.chambers.rear.resonance_hz.value);
      expect(readouts.rearResonance.value).toBeGreaterThan(0);
      expect(readouts.rearQtc.value).toBe(project.box.bandpass4.chambers.rear.q_tc.value);
      expect(readouts.rearQtc.value).toBeGreaterThan(0);
    });

    it('returns null for rearQtc when box is vented', () => {
      const {project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('vented');
      const projectChanged = ref(0);

      const readouts = createSealedReadouts({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
      });

      expect(readouts.rearQtc.value).toBeNull();
      expect(readouts.rearResonance.value).toBeGreaterThan(0);
    });

    it('recomputes rearResonance when volume changes and projectChanged fires', () => {
      const {project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('sealed');
      const projectChanged = ref(0);

      const readouts = createSealedReadouts({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
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
    const volumeOf = (project: ReturnType<typeof createCompleteProject>['project'], boxType: BoxType) =>
      createBoxVolume({project: computed(() => project), selectedBox: ref<BoxType>(boxType), projectChanged: ref(0)}).boxVolumeCell.value;

    it.each(boxTypes)('writes and reads back the %s box volume', (boxType) => {
      const {project} = createCompleteProject();
      project.box.boxType.set(boxType);
      const cell = volumeOf(project, boxType);
      cell.set(0.02);
      expect(cell.value).toBeCloseTo(0.02, 9);
    });

    it('keeps full precision across write and read', () => {
      const {project} = createCompleteProject();
      const cell = volumeOf(project, 'sealed');
      cell.set(0.012345678);
      expect(cell.value).toBeCloseTo(0.012345678, 12);
    });

    it('keeps a zero-or-less volume as entered with the domain\'s own ⚠, never coerced', () => {
      const {engine, project} = createCompleteProject();
      const cell = volumeOf(project, 'sealed');
      cell.set(0);
      expect(cell.value).toBe(0);
      expect(cell.dq).toEqual([engine.issues.positiveValueIssue(0)]);
      cell.set(0.02);
      expect(cell.dq).toEqual([]);
    });

    // bugs/BUG_20261005_no-common-ui-field-component.md, "just show errors".
    it('a cleared volume stays blank, with a ⚠ that marks it mandatory', () => {
      const {engine, project} = createCompleteProject();
      const cell = volumeOf(project, 'sealed');
      cell.clear();
      expect(cell.value).toBeNull();
      expect(cell.dq).toEqual([engine.issues.requiredPositiveIssue('Box volume', null, 'alignment')]);
      expect(cell.mandatoryAndUnsatisfied).toBe(true);
    });
  });

  describe('createSelectedBox', () => {
    /** `createSelectedBox` doesn't care WHICH types simulate, only that it asks — a stub keeps
     *  this test isolated from `appState.ts`'s own registry. */
    const isSimulatable = (b: BoxType) => b !== 'bandpass6' && b !== 'abc';

    it('initializes from the focused project\'s own box type', () => {
      const {project} = createCompleteProject();
      project.box.boxType.set('vented');
      const projectChanged = ref(0);

      const {selectedBox} = createSelectedBox({ focusedProject: () => project, projectChanged, isSimulatable });

      expect(selectedBox.value).toBe('vented');
    });

    it('defaults to sealed when no project is focused', () => {
      const projectChanged = ref(0);
      const {selectedBox} = createSelectedBox({ focusedProject: () => null, projectChanged, isSimulatable });

      expect(selectedBox.value).toBe('sealed');
    });

    it('setting selectedBox to a simulatable type writes it to the project', async () => {
      const {project} = createCompleteProject();
      const projectChanged = ref(0);
      const {selectedBox} = createSelectedBox({ focusedProject: () => project, projectChanged, isSimulatable });

      selectedBox.value = 'vented';
      await nextTick();
      expect(project.box.boxType.value).toBe('vented');
    });

    it('setting selectedBox to a NON-simulatable (pending) type does NOT write the project — pending is UI-only', async () => {
      const {project} = createCompleteProject();
      const projectChanged = ref(0);
      const {selectedBox, pending} = createSelectedBox({ focusedProject: () => project, projectChanged, isSimulatable });

      selectedBox.value = 'bandpass6';
      await nextTick();
      expect(project.box.boxType.value).not.toBe('bandpass6');
      expect(pending.value).toBe(true);
    });

    it('an external change to the project\'s box type (e.g. a loaded file) syncs selectedBox back', async () => {
      const {project} = createCompleteProject();
      const projectChanged = ref(0);
      const {selectedBox} = createSelectedBox({ focusedProject: () => project, projectChanged, isSimulatable });

      project.box.boxType.set('vented');
      projectChanged.value++;
      await nextTick();
      expect(selectedBox.value).toBe('vented');
    });

    it('isDual is true only for the two-chamber types', () => {
      const {project} = createCompleteProject();
      const projectChanged = ref(0);
      const {selectedBox, isDual} = createSelectedBox({ focusedProject: () => project, projectChanged, isSimulatable });

      expect(isDual.value).toBe(false);
      selectedBox.value = 'bandpass4';
      expect(isDual.value).toBe(true);
    });

    it('showEnclosureTab is false only for sealed', () => {
      const {project} = createCompleteProject();
      const projectChanged = ref(0);
      const {selectedBox, showEnclosureTab} = createSelectedBox({ focusedProject: () => project, projectChanged, isSimulatable });

      expect(showEnclosureTab.value).toBe(false);
      selectedBox.value = 'vented';
      expect(showEnclosureTab.value).toBe(true);
    });
  });

  // bugs/BUG_20261006_box-losses-popup-blank-for-6th-and-abc.md,
  // bugs/BUG_20261007_advanced-link-opens-every-chamber-losses.md: the popup shows the one open set.
  describe('createBoxLosses', () => {
    function losses(type: BoxType) {
      const {project} = createCompleteProject();
      const projectChanged = ref(0);
      const hook = createBoxLosses({project: computed(() => project), selectedBox: ref<BoxType>(type), projectChanged, focusedProject: () => project});
      return {project, projectChanged, hook};
    }
    it('nothing is open until a chamber link opens it', () => {
      const {hook} = losses('bandpass6');
      expect(hook.openLossGroup.value).toBeNull();
    });
    it('sealed: the whole set is untitled with Ql and Qa, no Qp and no Qicl', () => {
      const {hook} = losses('sealed');
      hook.lossesOpen.value = 'whole';
      const g = hook.openLossGroup.value;
      expect(g!.heading).toBeNull();
      expect(g!.Qp).toBeNull();
      expect(g!.Qicl).toBeNull();
    });
    it('bandpass6: the rear link shows the Rear chamber set only, the front link the Front set only', () => {
      const {hook} = losses('bandpass6');
      hook.lossesOpen.value = 'rear';
      expect(hook.openLossGroup.value!.heading).toBe('Rear chamber');
      hook.lossesOpen.value = 'front';
      expect(hook.openLossGroup.value!.heading).toBe('Front chamber');
    });
    it('bandpass6: an edit in the open set reaches that chamber only', () => {
      const {project, hook} = losses('bandpass6');
      hook.lossesOpen.value = 'front';
      hook.openLossGroup.value!.Ql.set(9);
      expect(project.box.bandpass6.chambers.front.losses.Ql.value).toBe(9);
      expect(project.box.bandpass6.chambers.rear.losses.Ql.value).toBe(10);
    });
    it('bandpass4: the rear set has no Qp, the front set has one; both carry the one Qicl', () => {
      const {project, hook} = losses('bandpass4');
      hook.lossesOpen.value = 'rear';
      expect(hook.openLossGroup.value!.Qp).toBeNull();
      hook.lossesOpen.value = 'front';
      expect(hook.openLossGroup.value!.Qp!.value).toBe(100);
      hook.openLossGroup.value!.Qicl!.set(42);
      expect(project.box.bandpass4.chambers.rear.losses.Qicl.value).toBe(42);
    });
    it('abc: Reset puts the open chamber back to WinISD\'s defaults and leaves the other', () => {
      const {project, hook} = losses('abc');
      for (const chamber of ['rear', 'front'] as const) {
        hook.lossesOpen.value = chamber;
        const g = hook.openLossGroup.value!;
        g.Ql.set(3); g.Qa.set(4); g.Qp!.set(5);
      }
      hook.resetBoxLosses();
      const {rear, front} = project.box.abc.chambers;
      expect([front.losses.Ql.value, front.losses.Qa.value, front.losses.Qp.value]).toEqual([10, 100, 100]);
      expect([rear.losses.Ql.value, rear.losses.Qa.value, rear.losses.Qp.value]).toEqual([3, 4, 5]);
    });
  });
});
