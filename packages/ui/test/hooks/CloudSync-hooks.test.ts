import {describe, expect, it} from 'vitest';
import {createApp, ref} from 'vue';
import {createCloudUiStore, createMemoryStorage} from '@openisd/persistence';
import {provideCloudSync, useCloudSyncUi} from '../../src/hooks/CloudSync-hooks.js';
import {provideTelemetryUi} from '../../src/hooks/telemetryContext.js';
import {recordingTelemetryUi} from '../fixtures/recordingTelemetryUi.js';

// John, 10 Nov 2026: "scan rest of app for missed telemetry".
describe('useCloudSyncUi usage counts', () => {
  it('counts a tap on Connect and on Sync now', () => {
    const {telemetryUi, events} = recordingTelemetryUi();
    const app = createApp({render: () => null});
    provideCloudSync(app, null, createCloudUiStore(createMemoryStorage()));
    provideTelemetryUi(app, telemetryUi);
    const ui = app.runWithContext(() => useCloudSyncUi(ref(false), () => undefined));
    ui.connect();
    ui.syncNow();
    expect(events).toEqual([{kind: 'feature', name: 'cloud_connect'}, {kind: 'feature', name: 'cloud_sync'}]);
  });
});
