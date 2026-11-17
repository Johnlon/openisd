import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {compatSwitchSetter} from '../../src/hooks/compatSwitch.js';
import {useMobileAdvancedTab} from '../../src/hooks/MobileAdvancedTab-hooks.js';
import {recordingTelemetryUi} from '../fixtures/recordingTelemetryUi.js';
import {runHook} from './runHook.js';
import {testAppLogic} from './testAppLogic.js';

// John, 10 Nov 2026: "scan rest of app for missed telemetry".
describe('WinISD compatibility switches: usage counts', () => {
  it('setting a switch sets it and counts a compat switch', () => {
    const project = ProjectBuilder.empty(createEngine());
    const {telemetryUi, events} = recordingTelemetryUi();
    const set = compatSwitchSetter(telemetryUi.featureUse);
    const before = project.winisdWrapPhase.value;
    set(project.winisdWrapPhase, !before);
    expect(project.winisdWrapPhase.value).toBe(!before);
    expect(events).toEqual([{kind: 'feature', name: 'compat_switch'}]);
  });

  it('the phone Advanced tab hands its template the counting setter', () => {
    const logic = testAppLogic();
    const project = ProjectBuilder.empty(logic.engine);
    logic.appState.addProject(project);
    const {telemetryUi, events} = recordingTelemetryUi();
    const tab = runHook(computed(() => project), () => useMobileAdvancedTab(), logic, telemetryUi);
    tab.setCompatSwitch(project.winisdFlatModel, !project.winisdFlatModel.value);
    expect(events).toEqual([{kind: 'feature', name: 'compat_switch'}]);
  });
});
