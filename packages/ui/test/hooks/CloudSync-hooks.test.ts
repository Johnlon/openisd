import {describe, expect, it} from 'vitest';
import {createApp, ref} from 'vue';
import {createCloudUiStore, createMemoryStorage} from '@openisd/persistence';
import {DeviceId, ProjectId, type ConflictCopy} from '@openisd/design/cloud';
import type {CloudSync} from '@openisd/persistence';
import {createCloudSyncAPI, provideCloudSync, useCloudSyncUi} from '../../src/hooks/CloudSync-hooks.js';
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

function conflictCopy(uuid: string): ConflictCopy {
  const id = ProjectId.of(uuid);
  const from = DeviceId.of('dev-1');
  if (id === null || from === null) throw new Error('fixture ids are not empty');
  return {id, name: `Sub 12 (conflict, 18 Nov 2026, ${uuid})`, item: 'Sub 12', otherDevice: 'iPhone', from, at_ms: 1};
}

/** A sync whose conflict list the test sets, and whose watchers the test calls. */
function syncWithConflicts(): {sync: CloudSync; setConflicts(list: ConflictCopy[]): void} {
  let conflicts: ConflictCopy[] = [];
  let watcher = (): void => undefined;
  const unused = (): never => { throw new Error('not used here'); };
  const sync: CloudSync = {
    status: () => ({kind: 'off'}), conflicts: () => conflicts, activity: () => [], projectsNotOnDrive: () => new Set(),
    watch: onChange => { watcher = onChange; return () => undefined; },
    connect: () => undefined, reconnect: () => undefined, disconnect: async () => undefined, syncNow: async () => undefined,
    conflictSeen: () => undefined, onOutcome: () => undefined, runStarted: () => undefined, runMoved: () => undefined,
    runPushed: () => undefined, accountRefused: () => undefined, restoredFromBin: () => undefined,
    projectKeptBoth: () => undefined, diagnostics: unused,
  };
  return {sync, setConflicts: list => { conflicts = list; watcher(); }};
}

// A conflict the user opened leaves the list; the "seen" count must follow it down or the next conflict is never announced.
describe('the conflict notice after the user has opened a conflict copy', () => {
  it('counts the next conflict as news again', () => {
    const {sync, setConflicts} = syncWithConflicts();
    const uiStore = createCloudUiStore(createMemoryStorage());
    const api = createCloudSyncAPI(sync, uiStore);
    setConflicts([conflictCopy('first')]);
    api.setConflictsSeen(1);          // the user pressed View on the notice
    setConflicts([]);                 // and opened the copy: it left the list
    expect(api.ui.value.conflictsSeen).toBe(0);
    setConflicts([conflictCopy('second')]);
    expect(api.conflicts.value.length).toBeGreaterThan(api.ui.value.conflictsSeen);
  });

  it('keeps the count while the seen conflicts are still listed', () => {
    const {sync, setConflicts} = syncWithConflicts();
    const api = createCloudSyncAPI(sync, createCloudUiStore(createMemoryStorage()));
    setConflicts([conflictCopy('first'), conflictCopy('second')]);
    api.setConflictsSeen(2);
    setConflicts([conflictCopy('first'), conflictCopy('second')]);
    expect(api.ui.value.conflictsSeen).toBe(2);
  });
});
