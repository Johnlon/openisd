import {describe, expect, it} from 'vitest';
import {
  DeviceId,
  DriverId,
  PrId,
  ProjectId,
  type ConflictCopy,
  type SyncStatus,
} from '../../cloud/syncStatus.js';
import {syncDisplayOf, type SyncDisplayInputs} from '../../cloud/syncDisplay.js';

function sampleConflict(
  name = 'Sub 12 (conflict, phone, 13 Oct 2026, 21:05)',
  id: ConflictCopy['id'] = ProjectId.of('proj-1')!,
): ConflictCopy {
  return {
    id,
    name,
    from: DeviceId.of('device-phone')!,
    at_ms: 1776107100000,
  };
}

describe('syncDisplayOf — Drive sync plan P1-2 (sections 2.3, 6.1, 6.2)', () => {
  // Test time: 13 Oct 2026, 23:32 local time
  const sampleTime = new Date(2026, 9, 13, 23, 32).getTime();

  const defaultInputs = (status: SyncStatus, configured = true): SyncDisplayInputs => ({
    status,
    conflicts: [],
    conflictsSeen: 0,
    hintDismissed: false,
    launches: 1,
    updateBannerShown: false,
    configured,
  });

  const disconnectConfirm = {
    title: 'Disconnect Google Drive?',
    body: 'Your work stays in this browser and in your Drive. Changes made after this will not sync.',
    yes: 'Disconnect',
    no: 'Keep connected',
  };

  const offExplainer = 'Keeps your saved projects, drivers, passive radiators, favourites and Options in a hidden folder in your own Google Drive, so they follow you to your other devices. Nothing is stored anywhere else.';

  describe('6.1 display model rows', () => {
    it('row 1: off', () => {
      const display = syncDisplayOf(defaultInputs({kind: 'off'}));
      expect(display.glyph).toBe('cloudOff');
      expect(display.tone).toBe('muted');
      expect(display.badge).toBeNull();
      expect(display.shortText).toBe('Off');
      expect(display.text).toBe('Cloud sync is off');
      expect(display.tooltip).toBe('Sync your work across devices through your Google Drive. Tap to turn on.');
      expect(display.tap).toBe('openDialog');
      expect(display.strip).toBeNull();
      expect(display.hint).toBeNull();
      expect(display.conflictNotice).toBeNull();
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'muted',
        headline: 'Cloud sync is off',
        account: null,
        pendingLine: null,
        offExplainer,
        notConfiguredLine: null,
        buttons: [{action: 'connect', label: 'Connect Google Drive', enabled: true, primary: true}],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 1: off when not configured', () => {
      const display = syncDisplayOf(defaultInputs({kind: 'off'}, false));
      expect(display.dialog.buttons).toEqual([
        {action: 'connect', label: 'Connect Google Drive', enabled: false, primary: true},
      ]);
      expect(display.dialog.notConfiguredLine).toBe('Not set up yet.');
      expect(display.dialog.offExplainer).toBe(offExplainer);
    });

    it('row 2: connecting', () => {
      const display = syncDisplayOf(defaultInputs({kind: 'connecting'}));
      expect(display.glyph).toBe('cloudBusy');
      expect(display.tone).toBe('accent');
      expect(display.badge).toBeNull();
      expect(display.shortText).toBe('Connecting');
      expect(display.text).toBe('Connecting to Google Drive…');
      expect(display.tooltip).toBe('Connecting to Google Drive…');
      expect(display.tap).toBe('openDialog');
      expect(display.strip).toBeNull();
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'accent',
        headline: 'Connecting to Google Drive…',
        account: null,
        pendingLine: null,
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 3: syncing', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'syncing',
        account: 'john@gmail.com',
      }));
      expect(display.glyph).toBe('cloudBusy');
      expect(display.tone).toBe('accent');
      expect(display.badge).toBeNull();
      expect(display.shortText).toBe('Syncing');
      expect(display.text).toBe('Syncing…');
      expect(display.tooltip).toBe('Syncing…');
      expect(display.tap).toBe('openDialog');
      expect(display.strip).toBeNull();
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'accent',
        headline: 'Syncing…',
        account: 'john@gmail.com',
        pendingLine: null,
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [{action: 'disconnect', label: 'Disconnect', enabled: true, primary: false}],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 4: synced, no conflicts', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'synced',
        account: 'john@gmail.com',
        at_ms: sampleTime,
        conflicts: 0,
      }));
      expect(display.glyph).toBe('cloudDone');
      expect(display.tone).toBe('good');
      expect(display.badge).toBeNull();
      expect(display.shortText).toBe('Synced 23:32');
      expect(display.text).toBe('Synced 13 Oct 2026, 23:32');
      expect(display.tooltip).toBe('Up to date with Google Drive.');
      expect(display.tap).toBe('openDialog');
      expect(display.strip).toBeNull();
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'good',
        headline: 'Synced 13 Oct 2026, 23:32',
        account: 'john@gmail.com',
        pendingLine: null,
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [
          {action: 'syncNow', label: 'Sync now', enabled: true, primary: true},
          {action: 'disconnect', label: 'Disconnect', enabled: true, primary: false},
        ],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 5: synced, conflicts N', () => {
      const conflict1 = sampleConflict('Sub 12 (conflict, phone, 13 Oct 2026, 21:05)');
      const conflict2 = {
        ...sampleConflict('Dayton RS225 (conflict, tablet, 13 Oct 2026, 21:10)'),
        id: ProjectId.of('proj-2')!,
      };
      const display = syncDisplayOf({
        ...defaultInputs({
          kind: 'synced',
          account: 'john@gmail.com',
          at_ms: sampleTime,
          conflicts: 2,
        }),
        conflicts: [conflict1, conflict2],
        conflictsSeen: 2, // avoid conflict notice here to isolate row 5
      });
      expect(display.glyph).toBe('cloudAlert');
      expect(display.tone).toBe('warn');
      expect(display.badge).toBe(2);
      expect(display.shortText).toBe('2 conflicts');
      expect(display.text).toBe('Synced 13 Oct 2026, 23:32');
      expect(display.tooltip).toBe('2 items changed on two devices. Both kept. Tap to see them.');
      expect(display.tap).toBe('openDialog');
      expect(display.dialog.headline).toBe('Synced 13 Oct 2026, 23:32');
      expect(display.dialog.account).toBe('john@gmail.com');
      expect(display.dialog.pendingLine).toBeNull();
      expect(display.dialog.buttons).toEqual([
        {action: 'syncNow', label: 'Sync now', enabled: true, primary: true},
        {action: 'disconnect', label: 'Disconnect', enabled: true, primary: false},
      ]);
      expect(display.dialog.conflicts).toEqual([
        {id: conflict1.id, title: conflict1.name, sub: 'Both versions kept'},
        {id: conflict2.id, title: conflict2.name, sub: 'Both versions kept'},
      ]);
    });

    it('row 6: pending N', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'pending',
        account: 'john@gmail.com',
        at_ms: sampleTime,
        changes: 2,
      }));
      expect(display.glyph).toBe('cloudBusy');
      expect(display.tone).toBe('accent');
      expect(display.badge).toBe(2);
      expect(display.shortText).toBe('2 not synced');
      expect(display.text).toBe('2 changes not synced');
      expect(display.tooltip).toBe('2 changes will sync in a moment.');
      expect(display.tap).toBe('openDialog');
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'accent',
        headline: '2 changes not synced',
        account: 'john@gmail.com',
        pendingLine: '2 changes not synced',
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [
          {action: 'syncNow', label: 'Sync now', enabled: true, primary: true},
          {action: 'disconnect', label: 'Disconnect', enabled: true, primary: false},
        ],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 7: offline N', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'offline',
        account: 'john@gmail.com',
        at_ms: sampleTime,
        changes: 3,
      }));
      expect(display.glyph).toBe('cloudSlash');
      expect(display.tone).toBe('muted');
      expect(display.badge).toBe(3);
      expect(display.shortText).toBe('Offline');
      expect(display.text).toBe('Offline. 3 changes not synced');
      expect(display.tooltip).toBe('No connection. They will sync when you are back online.');
      expect(display.tap).toBe('openDialog');
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'muted',
        headline: 'Offline. 3 changes not synced',
        account: 'john@gmail.com',
        pendingLine: '3 changes not synced',
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [
          {action: 'syncNow', label: 'Sync now', enabled: true, primary: true},
          {action: 'disconnect', label: 'Disconnect', enabled: true, primary: false},
        ],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 7: offline with 0 changes', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'offline',
        account: 'john@gmail.com',
        at_ms: sampleTime,
        changes: 0,
      }));
      expect(display.glyph).toBe('cloudSlash');
      expect(display.tone).toBe('muted');
      expect(display.badge).toBeNull();
      expect(display.shortText).toBe('Offline');
      expect(display.text).toBe('Offline');
      expect(display.tooltip).toBe('No connection. They will sync when you are back online.');
      expect(display.dialog.headline).toBe('Offline');
      expect(display.dialog.pendingLine).toBeNull();
    });

    it('row 8: reconnect N', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'reconnect',
        account: 'john@gmail.com',
        changes: 3,
      }));
      expect(display.glyph).toBe('cloudAlert');
      expect(display.tone).toBe('warn');
      expect(display.badge).toBe(3);
      expect(display.shortText).toBe('Reconnect');
      expect(display.text).toBe('Google needs you to connect again. 3 changes not synced');
      expect(display.tooltip).toBe('Google needs you to connect again. 3 changes not synced');
      expect(display.tap).toBe('reconnect');
      expect(display.strip).toEqual({
        text: '⚠ Google needs you to connect again. 3 changes not synced.',
        button: 'Reconnect',
      });
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'warn',
        headline: 'Google needs you to connect again. 3 changes not synced',
        account: 'john@gmail.com',
        pendingLine: '3 changes not synced',
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [
          {action: 'reconnect', label: 'Reconnect', enabled: true, primary: true},
          {action: 'disconnect', label: 'Disconnect', enabled: true, primary: false},
        ],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 9: held N', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'held',
        account: 'john@gmail.com',
        at_ms: sampleTime,
        heldDocs: 4,
      }));
      expect(display.glyph).toBe('cloudAlert');
      expect(display.tone).toBe('warn');
      expect(display.badge).toBe(4);
      expect(display.shortText).toBe('Update app');
      expect(display.text).toBe('Update the app to sync 4 projects saved by a newer version');
      expect(display.tooltip).toBe('Update the app to sync 4 projects saved by a newer version');
      expect(display.tap).toBe('openDialog');
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'warn',
        headline: 'Update the app to sync 4 projects saved by a newer version',
        account: 'john@gmail.com',
        pendingLine: null,
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [
          {action: 'syncNow', label: 'Sync now', enabled: true, primary: true},
          {action: 'disconnect', label: 'Disconnect', enabled: true, primary: false},
        ],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 10: refused', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'refused',
        account: 'john@gmail.com',
        reason: 'noRoom',
      }));
      expect(display.glyph).toBe('cloudAlert');
      expect(display.tone).toBe('bad');
      expect(display.badge).toBeNull();
      expect(display.shortText).toBe('Not synced');
      expect(display.text).toBe('Nothing synced. No room in this browser to back up first. Export, then try again.');
      expect(display.tooltip).toBe('Nothing synced. No room in this browser to back up first. Export, then try again.');
      expect(display.tap).toBe('openDialog');
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'bad',
        headline: 'Nothing synced. No room in this browser to back up first. Export, then try again.',
        account: 'john@gmail.com',
        pendingLine: null,
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [{action: 'disconnect', label: 'Disconnect', enabled: true, primary: false}],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });

    it('row 11: failed', () => {
      const display = syncDisplayOf(defaultInputs({
        kind: 'failed',
        account: 'john@gmail.com',
        reason: 'Sign-in service unreachable',
      }));
      expect(display.glyph).toBe('cloudAlert');
      expect(display.tone).toBe('bad');
      expect(display.badge).toBeNull();
      expect(display.shortText).toBe('Sync failed');
      expect(display.text).toBe('Sync failed: Sign-in service unreachable. It will try again.');
      expect(display.tooltip).toBe('Sync failed: Sign-in service unreachable. It will try again.');
      expect(display.tap).toBe('openDialog');
      expect(display.dialog).toEqual({
        title: 'Cloud sync',
        providerHeading: 'Google Drive',
        tone: 'bad',
        headline: 'Sync failed: Sign-in service unreachable. It will try again.',
        account: 'john@gmail.com',
        pendingLine: null,
        offExplainer: null,
        notConfiguredLine: null,
        buttons: [
          {action: 'syncNow', label: 'Sync now', enabled: true, primary: true},
          {action: 'disconnect', label: 'Disconnect', enabled: true, primary: false},
        ],
        conflictsHeading: 'Conflict copies',
        conflictOpenLabel: 'Open',
        conflicts: [],
        disconnectConfirm,
      });
    });
  });

  describe('type constraints: synced status cannot hold pending changes', () => {
    it('synced and "N not synced" are never shown together', () => {
      const status: SyncStatus = {
        kind: 'synced',
        account: 'john@gmail.com',
        at_ms: sampleTime,
        conflicts: 0,
      };
      const display = syncDisplayOf(defaultInputs(status));

      expect(display.text).toMatch(/^Synced /);
      expect(display.text).not.toContain('not synced');
      expect(display.shortText).toMatch(/^Synced /);
      expect(display.shortText).not.toContain('not synced');
      expect(display.dialog.headline).toMatch(/^Synced /);
      expect(display.dialog.pendingLine).toBeNull();
    });
  });

  describe('banner/strip slot behaviors', () => {
    it('updateBannerShown → strip is null even when reconnecting', () => {
      const displayWithUpdateBanner = syncDisplayOf({
        ...defaultInputs({
          kind: 'reconnect',
          account: 'john@gmail.com',
          changes: 3,
        }),
        updateBannerShown: true,
      });
      expect(displayWithUpdateBanner.strip).toBeNull();

      const displayWithoutUpdateBanner = syncDisplayOf({
        ...defaultInputs({
          kind: 'reconnect',
          account: 'john@gmail.com',
          changes: 3,
        }),
        updateBannerShown: false,
      });
      expect(displayWithoutUpdateBanner.strip).not.toBeNull();
      expect(displayWithoutUpdateBanner.strip?.button).toBe('Reconnect');
    });

    it('hint only when launches >= 2, status off, and not dismissed', () => {
      // launches < 2
      expect(syncDisplayOf({
        ...defaultInputs({kind: 'off'}),
        launches: 1,
        hintDismissed: false,
      }).hint).toBeNull();

      // launches >= 2, off, not dismissed
      expect(syncDisplayOf({
        ...defaultInputs({kind: 'off'}),
        launches: 2,
        hintDismissed: false,
      }).hint).toEqual({
        text: 'Sync your projects across devices?',
        yes: 'Turn on',
        no: 'No thanks',
      });

      // launches >= 2, off, but dismissed
      expect(syncDisplayOf({
        ...defaultInputs({kind: 'off'}),
        launches: 2,
        hintDismissed: true,
      }).hint).toBeNull();

      // launches >= 2, not off (e.g. syncing or synced)
      expect(syncDisplayOf({
        ...defaultInputs({kind: 'syncing', account: 'john@gmail.com'}),
        launches: 2,
        hintDismissed: false,
      }).hint).toBeNull();
    });

    it('conflict notice only when conflicts.length > conflictsSeen', () => {
      const conflict1 = sampleConflict('Sub 12');
      const conflict2 = sampleConflict('Driver 1');

      // 0 conflicts
      expect(syncDisplayOf({
        ...defaultInputs({kind: 'synced', account: 'john@gmail.com', at_ms: sampleTime, conflicts: 0}),
        conflicts: [],
        conflictsSeen: 0,
      }).conflictNotice).toBeNull();

      // 2 conflicts, none seen yet
      expect(syncDisplayOf({
        ...defaultInputs({kind: 'synced', account: 'john@gmail.com', at_ms: sampleTime, conflicts: 2}),
        conflicts: [conflict1, conflict2],
        conflictsSeen: 0,
      }).conflictNotice).toEqual({
        text: '2 items changed on two devices. Both kept.',
        button: 'View',
      });

      // 2 conflicts, already seen 2
      expect(syncDisplayOf({
        ...defaultInputs({kind: 'synced', account: 'john@gmail.com', at_ms: sampleTime, conflicts: 2}),
        conflicts: [conflict1, conflict2],
        conflictsSeen: 2,
      }).conflictNotice).toBeNull();

      // 2 conflicts, but conflictsSeen is 3 (edge case: seen > length)
      expect(syncDisplayOf({
        ...defaultInputs({kind: 'synced', account: 'john@gmail.com', at_ms: sampleTime, conflicts: 2}),
        conflicts: [conflict1, conflict2],
        conflictsSeen: 3,
      }).conflictNotice).toBeNull();
    });

    it('mixed conflict list uses "item" wording', () => {
      const projConflict = sampleConflict('Project A', ProjectId.of('proj-1')!);
      const driverConflict = sampleConflict('Driver B', DriverId.of('drv-1')!);
      const prConflict = sampleConflict('PR C', PrId.of('pr-1')!);
      const display = syncDisplayOf({
        ...defaultInputs({
          kind: 'synced',
          account: 'john@gmail.com',
          at_ms: sampleTime,
          conflicts: 3,
        }),
        conflicts: [projConflict, driverConflict, prConflict],
        conflictsSeen: 0,
      });
      expect(display.tooltip).toBe('3 items changed on two devices. Both kept. Tap to see them.');
      expect(display.conflictNotice).toEqual({
        text: '3 items changed on two devices. Both kept.',
        button: 'View',
      });
    });

    it('single conflict uses singular "item"', () => {
      const driverConflict = sampleConflict('Driver B', DriverId.of('drv-1')!);
      const display = syncDisplayOf({
        ...defaultInputs({
          kind: 'synced',
          account: 'john@gmail.com',
          at_ms: sampleTime,
          conflicts: 1,
        }),
        conflicts: [driverConflict],
        conflictsSeen: 0,
      });
      expect(display.tooltip).toBe('1 item changed on two devices. Both kept. Tap to see them.');
      expect(display.conflictNotice).toEqual({
        text: '1 item changed on two devices. Both kept.',
        button: 'View',
      });
    });
  });

  describe('module export and calling conventions', () => {
    it('packages/design/cloud/index.js re-exports syncDisplayOf and ID classes', async () => {
      const barrel = await import('../../cloud/index.js');
      expect(typeof barrel.syncDisplayOf).toBe('function');
      expect(typeof barrel.DeviceId).toBe('function');
      expect(typeof barrel.ProjectId).toBe('function');
      expect(typeof barrel.DriverId).toBe('function');
      expect(typeof barrel.PrId).toBe('function');

      // lowercase constructor functions and isX guards must not be exported
      expect('deviceId' in barrel).toBe(false);
      expect('projectId' in barrel).toBe(false);
      expect('driverId' in barrel).toBe(false);
      expect('prId' in barrel).toBe(false);
      expect('isDeviceId' in barrel).toBe(false);
      expect('isProjectId' in barrel).toBe(false);
      expect('isDriverId' in barrel).toBe(false);
      expect('isPrId' in barrel).toBe(false);

      const res = barrel.syncDisplayOf(defaultInputs({kind: 'off'}));
      expect(res.shortText).toBe('Off');
    });
  });

  describe('ID classes (DeviceId, ProjectId, DriverId, PrId)', () => {
    it('DeviceId: non-empty after trim returns instance, empty returns null, equals compares text', () => {
      const id1 = DeviceId.of('device-1');
      const id2 = DeviceId.of('  device-1  ');
      const id3 = DeviceId.of('device-2');
      expect(id1).not.toBeNull();
      expect(id1?.text).toBe('device-1');
      expect(id2?.text).toBe('device-1');
      expect(id1?.equals(id2!)).toBe(true);
      expect(id1?.equals(id3!)).toBe(false);
      expect(DeviceId.of('')).toBeNull();
      expect(DeviceId.of('   \t\n  ')).toBeNull();
    });

    it('ProjectId: non-empty after trim returns instance, empty returns null, equals compares text', () => {
      const id1 = ProjectId.of('proj-1');
      const id2 = ProjectId.of('  proj-1  ');
      const id3 = ProjectId.of('proj-2');
      expect(id1).not.toBeNull();
      expect(id1?.text).toBe('proj-1');
      expect(id2?.text).toBe('proj-1');
      expect(id1?.equals(id2!)).toBe(true);
      expect(id1?.equals(id3!)).toBe(false);
      expect(ProjectId.of('')).toBeNull();
      expect(ProjectId.of('   \t\n  ')).toBeNull();
    });

    it('DriverId: non-empty after trim returns instance, empty returns null, equals compares text', () => {
      const id1 = DriverId.of('driver-1');
      const id2 = DriverId.of('  driver-1  ');
      const id3 = DriverId.of('driver-2');
      expect(id1).not.toBeNull();
      expect(id1?.text).toBe('driver-1');
      expect(id2?.text).toBe('driver-1');
      expect(id1?.equals(id2!)).toBe(true);
      expect(id1?.equals(id3!)).toBe(false);
      expect(DriverId.of('')).toBeNull();
      expect(DriverId.of('   \t\n  ')).toBeNull();
    });

    it('PrId: non-empty after trim returns instance, empty returns null, equals compares text', () => {
      const id1 = PrId.of('pr-1');
      const id2 = PrId.of('  pr-1  ');
      const id3 = PrId.of('pr-2');
      expect(id1).not.toBeNull();
      expect(id1?.text).toBe('pr-1');
      expect(id2?.text).toBe('pr-1');
      expect(id1?.equals(id2!)).toBe(true);
      expect(id1?.equals(id3!)).toBe(false);
      expect(PrId.of('')).toBeNull();
      expect(PrId.of('   \t\n  ')).toBeNull();
    });
  });
});


describe('id classes are nominal', () => {
  it('a ProjectId is not accepted where a DeviceId is expected', () => {
    const project = ProjectId.of('p1');
    // @ts-expect-error a ProjectId is not a DeviceId
    const device: DeviceId | null = project;
    expect(device?.text).toBe('p1');
  });
});
