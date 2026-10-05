import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {CompatSwitch, ProjectBuilder} from '@openisd/design';
import {CompatSwitchGroup} from '@openisd/design/fields';
import {addProject} from '../../src/logic/appState.js';
import {runHook} from './runHook.js';
import {useResetToWinisd} from '../../src/hooks/ResetToWinisd-hooks.js';

function heldProject() {
  const project = ProjectBuilder.empty(createEngine());
  addProject(project);
  return project;
}

describe('ResetToWinisd-hooks', () => {
  it('shows the design package\'s label and tooltip', () => {
    const api = runHook(computed(() => heldProject()), useResetToWinisd);
    expect(api.label).toBe(CompatSwitchGroup.RESET.heading);
    expect(api.tooltip).toBe(CompatSwitchGroup.RESET.tooltip);
  });

  it('reset sets every option to WinISD\'s side and unticks every bug on the focused project', () => {
    const project = heldProject();
    for (const s of CompatSwitch.BUGS) s.of(project).set(true);
    for (const s of CompatSwitch.OPTIONS) s.of(project).set(false);
    const api = runHook(computed(() => project), useResetToWinisd);
    api.reset();
    expect(CompatSwitch.BUGS.map(s => s.of(project).value)).toEqual(CompatSwitch.BUGS.map(() => false));
    expect(CompatSwitch.OPTIONS.map(s => s.of(project).value)).toEqual(CompatSwitch.OPTIONS.map(() => true));
  });
});
