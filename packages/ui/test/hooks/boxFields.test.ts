import {describe, expect, it} from 'vitest';
import {computed, nextTick, ref, shallowRef} from 'vue';
import {createEngine, type BoxType} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {
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

    it('keeps a zero-or-less volume as entered and reports the domain\'s own note via boxVolumeDqNote, never coerced', () => {
      const {engine, project} = createCompleteProject();
      const projectRef = shallowRef(project);
      const selectedBox = ref<BoxType>('sealed');
      const projectChanged = ref(0);
      const zeroVolumeMark = engine.issues.positiveValueIssue(0);
      if (zeroVolumeMark === null) throw new Error('0 must carry the positive-value mark');
      const expectedNote = zeroVolumeMark.text;

      const {boxVolume_m3, setBoxVolume_m3, boxVolumeDqNote} = createBoxVolume({
        project: computed(() => projectRef.value),
        selectedBox,
        projectChanged,
      });

      setBoxVolume_m3(0);
      projectChanged.value++;
      expect(boxVolume_m3.value).toBe(0);
      expect(boxVolumeDqNote.value).toBe(expectedNote);

      setBoxVolume_m3(-1);
      projectChanged.value++;
      expect(boxVolume_m3.value).toBe(-1);
      expect(boxVolumeDqNote.value).toBe(expectedNote);

      setBoxVolume_m3(0.02);
      projectChanged.value++;
      expect(boxVolumeDqNote.value).toBe('');
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
});
