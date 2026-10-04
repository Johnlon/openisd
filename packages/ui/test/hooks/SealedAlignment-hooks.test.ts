import {describe, expect, it} from 'vitest';
import {computed, ref, shallowRef} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {SealedAlignmentEditor} from '../../src/hooks/SealedAlignment-hooks.js';

function completeProject() {
  const engine = createEngine();
  const project = ProjectBuilder.empty(engine);
  project.driver.specs.Fs_hz.set(40);
  project.driver.specs.Qts.set(0.38);
  project.driver.specs.Qes.set(0.45);
  project.driver.specs.Vas_m3.set(0.03);
  project.box.sealed.volume_m3.set(0.012);
  return {engine, project};
}

describe('SealedAlignmentEditor', () => {
  it('keeps alignment edits in draft state until Accept', () => {
    const {engine, project} = completeProject();
    const projectRef = shallowRef(project);
    const editor = new SealedAlignmentEditor(computed(() => projectRef.value), ref(0), engine.sealed, engine.driver);

    editor.openEditor();
    editor.selectQtc(0.707);
    expect(editor.volume_m3.value).toBeGreaterThan(0);
    expect(project.box.sealed.volume_m3.value).toBe(0.012);

    editor.cancel();
    expect(project.box.sealed.volume_m3.value).toBe(0.012);
  });

  it('accepts an edited volume and reports the closest WinISD option', () => {
    const {engine, project} = completeProject();
    const projectRef = shallowRef(project);
    const editor = new SealedAlignmentEditor(computed(() => projectRef.value), ref(0), engine.sealed, engine.driver);

    editor.openEditor();
    editor.volume_m3.value = 0.012;
    expect(editor.selectedOption.value?.value).toBeCloseTo(0.707, 2);
    editor.accept();

    expect(project.box.sealed.volume_m3.value).toBeCloseTo(0.012, 9);
  });
});
