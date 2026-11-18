import {describe, expect, it} from 'vitest';
import {ref} from 'vue';
import {DesktopHelp} from '@openisd/design/fields';
import type {BoxType} from '@openisd/design/engine';
import {createDesktopHelp} from '../../src/hooks/desktopHelp.js';
import type {TabId} from '../../src/logic/tabId.js';
import {recordingTelemetryUi} from '../fixtures/recordingTelemetryUi.js';

// John, 10 Nov 2026: "scan rest of app for missed telemetry".
describe('createDesktopHelp usage counts', () => {
  it('counts help opened from a band ? and from a tab ?', () => {
    const {telemetryUi, events} = recordingTelemetryUi();
    const help = createDesktopHelp({activeTab: ref<TabId>('filters'), selectedBox: ref<BoxType>('sealed'), driverWiringApplies: ref(false), featureUse: telemetryUi.featureUse});
    help.openSectionHelp(DesktopHelp.FRONT_CHAMBER);
    expect(events).toEqual([{kind: 'feature', name: 'help'}]);
    help.openTabHelp();
    expect(telemetryUi.actions.snapshot()).toEqual(['feature:help', 'feature:help']);
  });

  it("the Placement band's help lists Driver wiring only while that control is drawn", () => {
    const {telemetryUi} = recordingTelemetryUi();
    const applies = ref(false);
    const help = createDesktopHelp({activeTab: ref<TabId>('driver'), selectedBox: ref<BoxType>('sealed'), driverWiringApplies: applies, featureUse: telemetryUi.featureUse});
    expect(help.placementHelp.value.rows.map(r => r.label)).not.toContain('Driver wiring');
    applies.value = true;
    expect(help.placementHelp.value.rows.map(r => r.label)).toContain('Driver wiring');
  });
});
