import {describe, expect, it} from 'vitest';
import {computed} from 'vue';
import {ProjectBuilder} from '@openisd/design';
import {usePhoneHelpSheet} from '../../src/hooks/PhoneHelpSheet-hooks.js';
import {recordingTelemetryUi} from '../fixtures/recordingTelemetryUi.js';
import {runHook} from './runHook.js';
import {testAppLogic} from './testAppLogic.js';

// John, 10 Nov 2026: "scan rest of app for missed telemetry". The sheet exists only while help is open.
describe('usePhoneHelpSheet', () => {
  it('counts phone help opened', () => {
    const logic = testAppLogic();
    const project = ProjectBuilder.empty(logic.engine);
    const {telemetryUi, events} = recordingTelemetryUi();
    runHook(computed(() => project), () => usePhoneHelpSheet(), logic, telemetryUi);
    expect(events).toEqual([{kind: 'feature', name: 'help'}]);
  });
});
