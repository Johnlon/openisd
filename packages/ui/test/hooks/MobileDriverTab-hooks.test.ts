import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {OpenISDDriver, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {readFileSync} from 'node:fs';
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

describe('MobileDriverTab-hooks Driver help (T882)', () => {
  function tabFor(nDrivers: number) {
    const logic = testAppLogic();
    const driver = OpenISDDriver.fromOwdrText(readFileSync('packages/ui/public/drivers/dayton-audio/da215-8.json', 'utf8'), createEngine());
    if (Array.isArray(driver)) throw new Error(driver.join('; '));
    const project = new ProjectBuilder(driver, logic.appState.engine).sealed().volume_m3(0.16).build();
    project.nDrivers.set(nDrivers);
    logic.appState.addProject(project);
    const {telemetryUi} = recordingTelemetryUi();
    return runHook(computed(() => project), () => useMobileDriverTab(), logic, telemetryUi);
  }

  it('lists Driver wiring only while the control is drawn (2 or more drivers)', () => {
    expect(tabFor(1).driverHelp.value.rows.map(r => r.label)).not.toContain('Driver wiring');
    expect(tabFor(4).driverHelp.value.rows.map(r => r.label)).toContain('Driver wiring');
  });
});
