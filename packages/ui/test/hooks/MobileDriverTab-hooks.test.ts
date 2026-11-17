import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {ProjectBuilder} from '@openisd/design';
import {useMobileDriverTab} from '../../src/hooks/MobileDriverTab-hooks.js';
import {recordingTelemetryUi} from '../fixtures/recordingTelemetryUi.js';
import {runHook} from './runHook.js';
import {testAppLogic} from './testAppLogic.js';

// John, 10 Nov 2026: "scan rest of app for missed telemetry".
describe('MobileDriverTab-hooks usage counts', () => {
  it('counts the Driver Editor opened from Edit and from the disagreements link', () => {
    const logic = testAppLogic();
    const project = ProjectBuilder.empty(logic.appState.engine);
    logic.appState.addProject(project);
    const {telemetryUi, events} = recordingTelemetryUi();
    const tab = runHook(computed(() => project), () => useMobileDriverTab(), logic, telemetryUi);
    tab.editDriver();
    expect(events).toEqual([{kind: 'feature', name: 'driver_editor'}]);
    tab.showDisagreements();
    expect(telemetryUi.actions.snapshot()).toEqual(['dialog:driver-editor', 'dialog:driver-editor']);
  });
});
