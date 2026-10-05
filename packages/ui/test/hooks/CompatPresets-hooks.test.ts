import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {CompatPreset, ProjectBuilder} from '@openisd/design';
import {addProject} from '../../src/logic/appState.js';
import {runHook} from './runHook.js';
import {useCompatPresets} from '../../src/hooks/CompatPresets-hooks.js';

function heldProject() {
  const project = ProjectBuilder.empty(createEngine());
  addProject(project);   // the change tick only fires for a project appState holds
  return project;
}

describe('CompatPresets-hooks', () => {
  it('offers the three presets in button order', () => {
    const api = runHook(computed(() => heldProject()), useCompatPresets);
    expect(api.presets).toEqual(CompatPreset.ALL);
  });

  it('a new project matches WinISD-ish; applying a preset makes it current', () => {
    const project = heldProject();
    const api = runHook(computed(() => project), useCompatPresets);
    expect(api.current.value).toBe(CompatPreset.WINISD_ISH);
    expect(api.currentLabel.value).toBe('WinISD-ish');
    api.apply(CompatPreset.DEBUGGED);
    expect(api.current.value).toBe(CompatPreset.DEBUGGED);
    expect(project.winisdWrapPhase.value).toBe(false);
  });

  it('a mix no preset holds reads "Custom"', () => {
    const project = heldProject();
    const api = runHook(computed(() => project), useCompatPresets);
    project.winisdVaModel.set(true);
    expect(api.current.value).toBeNull();
    expect(api.currentLabel.value).toBe('Custom');
  });
});
