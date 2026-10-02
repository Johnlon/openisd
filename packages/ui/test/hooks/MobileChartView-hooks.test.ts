import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {addProject} from '../../src/logic/appState.js';
import {cycleTraceColor} from '../../src/logic/presentationState.js';
import {useMobileChartView} from '../../src/hooks/MobileChartView-hooks.js';
import {runHook} from './runHook.js';

describe('useMobileChartView', () => {
  it('traceColour follows the project when its colour is cycled after the first read', () => {
    const project = ProjectBuilder.empty(createEngine());
    addProject(project);   // the change tick only fires for a project appState holds
    const hook = runHook(computed(() => project), useMobileChartView);
    const before = hook.traceColour.value;
    cycleTraceColor(project);
    expect(hook.traceColour.value).not.toBe(before);
  });
});
