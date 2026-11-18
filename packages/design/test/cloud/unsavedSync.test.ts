import {describe, expect, it} from 'vitest';
import {
  UNSAVED_ASK_AFTER_MS,
  UNSAVED_SYNC_TEXT,
  cloudSyncIsOn,
  saveTooltip,
  unsavedBarOf,
  unsavedSyncList,
} from '../../cloud/unsavedSync.js';
import {syncDisplayOf} from '../../cloud/syncDisplay.js';
import {DeviceId, ProjectId, type ConflictCopy, type SyncStatus} from '../../cloud/syncStatus.js';

const SYNCED: SyncStatus = {kind: 'synced', account: 'a@b.c', at_ms: 1, conflicts: 0};
const USUAL = 'Save - saves the file to browser storage. Use Export to save as file';

describe('Cloud sync on: telling and asking people to save (John, 18 Nov 2026, QO946.c244/c245)', () => {
  it('asks after 5 minutes', () => {
    expect(UNSAVED_ASK_AFTER_MS).toBe(300_000);
  });

  it('is on in every status but off', () => {
    expect(cloudSyncIsOn({kind: 'off'})).toBe(false);
    expect(cloudSyncIsOn({kind: 'connecting'})).toBe(true);
    expect(cloudSyncIsOn(SYNCED)).toBe(true);
    expect(cloudSyncIsOn({kind: 'offline', account: 'a', at_ms: null, changes: 2})).toBe(true);
    expect(cloudSyncIsOn({kind: 'reconnect', account: 'a', changes: 0})).toBe(true);
  });

  it('changes the Save tooltip only while sync is on', () => {
    expect(saveTooltip(true, USUAL)).toBe('Save - to send this version to your other devices');
    expect(saveTooltip(false, USUAL)).toBe(USUAL);
  });

  it('lists the projects with unsaved changes, each with a Save, only while sync is on', () => {
    const projects = [{id: 'p1', name: 'Sub 12'}, {id: 'p2', name: 'Tower'}];
    const list = unsavedSyncList(true, projects);
    expect(list?.heading).toBe('Not on your other devices yet');
    expect(list?.rows).toEqual([
      {id: 'p1', name: 'Sub 12', saveLabel: 'Save', saveAria: 'Save Sub 12'},
      {id: 'p2', name: 'Tower', saveLabel: 'Save', saveAria: 'Save Tower'},
    ]);
    expect(unsavedSyncList(false, projects)).toBeNull();
    expect(unsavedSyncList(true, [])?.rows).toEqual([]);
    expect(unsavedSyncList(true, [])?.empty).toBe('Every open project is saved.');
  });

  it('words the bar with a Save and a Later', () => {
    expect(unsavedBarOf({id: 'p1', name: 'Sub 12'})).toEqual({
      id: 'p1', text: 'Your changes are not on your other devices yet.', save: 'Save', later: 'Later',
    });
    expect(UNSAVED_SYNC_TEXT.barLater).toBe('Later');
  });
});

describe('the conflict notice for a project names both projects', () => {
  const copy: ConflictCopy = {
    id: ProjectId.of('p-copy')!,
    name: 'Sub 12 (conflict, 18 Nov 2026, Windows desktop)',
    item: 'Sub 12',
    otherDevice: 'iPhone',
    from: DeviceId.of('dev')!,
    at_ms: 1,
  };

  it('says the pulled project keeps the name and yours is the marked copy', () => {
    const display = syncDisplayOf({
      status: SYNCED, conflicts: [copy], activity: [], conflictsSeen: 0, hintDismissed: false, launches: 1,
      updateBannerShown: false, reconnectDismissed: false, configured: true,
    });
    expect(display.conflictNotice?.text).toBe(
      'Project "Sub 12" kept both: yours and the copy from iPhone. Yours is now "Sub 12 (conflict, 18 Nov 2026, Windows desktop)".');
  });
});
