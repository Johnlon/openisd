import {describe, expect, it, beforeEach} from 'vitest';
import {computed} from 'vue';
import {createEngine} from '@openisd/design/engine';
import {ProjectBuilder} from '@openisd/design';
import {cycleTraceColor} from '../../src/logic/presentationState.js';
import {useMobileChartView} from '../../src/hooks/MobileChartView-hooks.js';
import {runHook} from './runHook.js';
import {testAppLogic} from './testAppLogic.js';
import type {AppLogic} from '../../src/logic/app.js';
import type {AppState} from '../../src/logic/appState.js';

let logic: AppLogic;
let appState: AppState;

beforeEach(() => {
  logic = testAppLogic();
  appState = logic.appState;
});

describe('useMobileChartView', () => {
  it('traceColour follows the project when its colour is cycled after the first read', () => {
    const project = ProjectBuilder.empty(createEngine());
    appState.addProject(project);   // the change tick only fires for a project appState holds
    const hook = runHook(computed(() => project), useMobileChartView, logic);
    const before = hook.traceColour.value;
    cycleTraceColor(project);
    expect(hook.traceColour.value).not.toBe(before);
  });
});
