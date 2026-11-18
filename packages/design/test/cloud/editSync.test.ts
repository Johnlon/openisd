import {describe, expect, it} from 'vitest';
import {SYNC_AFTER_EDIT_MS} from '../../cloud/editSync.js';
import {syncDisplayOf} from '../../cloud/syncDisplay.js';
import {DeviceId, ProjectId, type ConflictCopy, type SyncStatus} from '../../cloud/syncStatus.js';

const SYNCED: SyncStatus = {kind: 'synced', account: 'a@b.c', at_ms: 1, conflicts: 0};

describe('Cloud sync sends unsaved edits a few seconds after editing stops (John, 18 Nov 2026, QO946.c247/c248)', () => {
  it('waits 3 seconds after the last edit', () => {
    expect(SYNC_AFTER_EDIT_MS).toBe(3000);
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
