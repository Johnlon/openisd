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
    const help = createDesktopHelp({activeTab: ref<TabId>('filters'), selectedBox: ref<BoxType>('sealed'), featureUse: telemetryUi.featureUse});
    help.openSectionHelp(DesktopHelp.FRONT_CHAMBER);
    expect(events).toEqual([{kind: 'feature', name: 'help'}]);
    help.openTabHelp();
    expect(telemetryUi.actions.snapshot()).toEqual(['feature:help', 'feature:help']);
  });
});
