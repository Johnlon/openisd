import {describe, expect, it} from 'vitest';
import {cloudSyncReportLines, cloudSyncSummary, type CloudAttemptOutcome, type CloudSyncReport} from '../../cloud/cloudSyncReport.js';
import {formatDateTime, formatTime} from '../../fields/format.js';

const AT_MS = Date.UTC(2026, 9, 14, 11, 0, 0);
const AT = formatDateTime(new Date(AT_MS));
const END_MS = AT_MS + 90_000;
const END = formatTime(new Date(END_MS));

describe('cloudSyncReportLines', () => {
  it('names each item a run moved, in place of the counts; "run ended: synced" stays its own line', () => {
    const at = (m: number) => new Date(2026, 9, 14, 14, 56, m).getTime();
    const lines = cloudSyncReportLines({
      grant: {kind: 'none'}, lastAttempt: null, pendingChanges: 0, lastFault: null, accountFault: null,
      events: [
        {kind: 'ended', at_ms: at(3), outcome: {kind: 'synced', left: 0, removedDuplicates: 0}},
        {kind: 'activity', at_ms: at(2), activity: {kind: 'keptBoth', at_ms: at(2), item: 'driver', name: 'W5-1138SMF', copyName: 'W5-1138SMF (conflict, 14 Oct 2026, Windows PC)', device: 'iPhone'}},
        {kind: 'activity', at_ms: at(1), activity: {kind: 'moved', at_ms: at(1), direction: 'up', change: 'saved', item: 'project', name: 'Sub 12', device: ''}},
      ],
    });
    expect(lines.slice(-3)).toEqual([
      '    14:56:03 run ended: synced',
      '    14:56:02 ⇅ Driver "W5-1138SMF" kept both: yours and the copy from iPhone; yours is "W5-1138SMF (conflict, 14 Oct 2026, Windows PC)"',
      '    14:56:01 ↑ Project "Sub 12" sent',
    ]);
  });

  it('says cloud sync is off when this window has none', () => {
    expect(cloudSyncReportLines(null)).toEqual(['Cloud sync: not available in this window']);
  });

  it('a window that never connected says so, with no attempt and no error', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'none'}, lastAttempt: null, pendingChanges: 0, lastFault: null, accountFault: null, events: [],
    };
    expect(cloudSyncReportLines(report)).toEqual([
      'Cloud sync: not connected',
      '  pending changes: 0',
      '  last attempt: none since the app opened',
      '  last error: none since the last successful sync',
      '  recent events: none since the page opened',
    ]);
  });

  it('a connected window shows the account, the pending count and the last attempt', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'connected', account: 'john@example.com'},
      lastAttempt: {kind: 'ended', started_ms: AT_MS, ended_ms: END_MS, outcome: {kind: 'stopped', reason: 'offline', pushedSoFar: 0}},
      pendingChanges: 3,
      lastFault: null,
      accountFault: null, events: [],
    };
    expect(cloudSyncReportLines(report)).toEqual([
      'Cloud sync: connected as john@example.com',
      '  pending changes: 3',
      `  last attempt: started ${AT}, ended ${END}, stopped: offline, 0 pushed`,
      '  last error: none since the last successful sync',
      '  recent events: none since the page opened',
    ]);
  });

  it('a window that must reconnect names the account', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'reconnect', account: 'john@example.com'},
      lastAttempt: {kind: 'ended', started_ms: AT_MS, ended_ms: END_MS, outcome: {kind: 'reconnect'}},
      pendingChanges: 1,
      lastFault: null, accountFault: null, events: [],
    };
    expect(cloudSyncReportLines(report).slice(0, 3)).toEqual([
      'Cloud sync: must reconnect john@example.com',
      '  pending changes: 1',
      `  last attempt: started ${AT}, ended ${END}, must reconnect`,
    ]);
  });

  it('a run in progress shows its start and the pushes so far', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'connected', account: 'john@example.com'},
      lastAttempt: {kind: 'running', started_ms: AT_MS, pushed: 16},
      pendingChanges: 21,
      lastFault: null, accountFault: null, events: [],
    };
    expect(cloudSyncReportLines(report)[2]).toBe(`  last attempt: running since ${AT}, 16 pushed so far`);
  });

  it('an account the sign-in did not name is said to be unavailable, never left blank', () => {
    const lines = (grant: CloudSyncReport['grant']): string =>
      cloudSyncReportLines({grant, lastAttempt: null, pendingChanges: 0, lastFault: null, accountFault: null, events: []})[0] ?? '';
    expect(lines({kind: 'connected', account: ''})).toBe('Cloud sync: connected as Google account (name not available)');
    expect(lines({kind: 'reconnect', account: ''})).toBe('Cloud sync: must reconnect Google account (name not available)');
  });

  it('a refused account lookup says what Google replied', () => {
    const lines = cloudSyncReportLines({
      grant: {kind: 'connected', account: ''}, lastAttempt: null, pendingChanges: 0, lastFault: null,
      accountFault: {fault: {operation: 'about', status: 403, reason: 'insufficientPermissions', reply: '{}'}, at_ms: AT_MS}, events: [],
    });
    expect(lines).toContain(`  account lookup failed: ${AT}, HTTP 403, insufficientPermissions`);
  });

  it('the last error is shown in full', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'connected', account: 'john@example.com'},
      lastAttempt: {kind: 'ended', started_ms: AT_MS, ended_ms: END_MS, outcome: {kind: 'failed'}},
      pendingChanges: 2,
      lastFault: {
        fault: {operation: 'list', status: 200, reason: 'Not a file list', reply: '{"files":[]}'},
        at_ms: AT_MS,
      },
      accountFault: null, events: [],
    };
    expect(cloudSyncReportLines(report)).toEqual([
      'Cloud sync: connected as john@example.com',
      '  pending changes: 2',
      `  last attempt: started ${AT}, ended ${END}, failed`,
      `  last error: ${AT}`,
      '    request: list',
      '    HTTP status: 200',
      '    reason: Not a file list',
      '    reply: {"files":[]}',
      '  recent events: none since the page opened',
    ]);
  });

  it('names every attempt outcome in words', () => {
    const lineFor = (outcome: CloudAttemptOutcome): string =>
      cloudSyncReportLines({
        grant: {kind: 'none'}, lastAttempt: {kind: 'ended', started_ms: AT_MS, ended_ms: END_MS, outcome}, pendingChanges: 0, lastFault: null, accountFault: null, events: [],
      })[2] ?? '';
    expect(lineFor({kind: 'synced', left: 0, removedDuplicates: 0})).toBe(`  last attempt: started ${AT}, ended ${END}, synced`);
    expect(lineFor({kind: 'synced', left: 2, removedDuplicates: 0})).toBe(`  last attempt: started ${AT}, ended ${END}, synced, 2 left`);
    expect(lineFor({kind: 'synced', left: 0, removedDuplicates: 3})).toBe(`  last attempt: started ${AT}, ended ${END}, synced, removed 3 duplicate copies`);
    expect(lineFor({kind: 'stopped', reason: 'quota', pushedSoFar: 4})).toBe(`  last attempt: started ${AT}, ended ${END}, stopped: Drive quota, 4 pushed`);
    expect(lineFor({kind: 'notConnected'})).toBe(`  last attempt: started ${AT}, ended ${END}, not connected`);
    expect(lineFor({kind: 'refused', reason: 'noRoom', copyChars: 900, storeChars: 4000})).toBe(`  last attempt: started ${AT}, ended ${END}, refused: no room in this browser for the backup (copy 900 chars, store held 4000 chars)`);
    expect(lineFor({kind: 'refused', reason: 'bucketUnreadable'})).toBe(`  last attempt: started ${AT}, ended ${END}, refused: a local store is unreadable`);
  });

  it('lists the events newest first, each with its time; an error shows its request, status, reason and reply start', () => {
    const at = (s: number) => new Date(2026, 9, 14, 13, 42, s).getTime();
    const lines = cloudSyncReportLines({
      grant: {kind: 'connected', account: 'john@example.com'}, lastAttempt: null, pendingChanges: 0, lastFault: null, accountFault: null,
      events: [
        {kind: 'ended', at_ms: at(9), outcome: {kind: 'failed'}},
        {kind: 'error', at_ms: at(9), fault: {operation: 'list', status: 0, reason: 'Failed to fetch', reply: 'x'.repeat(300)}},
        {kind: 'started', at_ms: at(5)},
      ],
    });
    expect(lines.slice(-4)).toEqual([
      '  recent events, newest first:',
      '    13:42:09 run ended: failed',
      `    13:42:09 error: list, HTTP 0, Failed to fetch, reply: ${'x'.repeat(200)}`,
      '    13:42:05 run started',
    ]);
  });
});

describe('cloudSyncSummary', () => {
  const healthy: CloudSyncReport = {
    grant: {kind: 'connected', account: 'john@example.com'}, lastAttempt: null, pendingChanges: 0, lastFault: null, accountFault: null, events: [],
  };

  it('has nothing to say when there is no cloud sync or no error', () => {
    expect(cloudSyncSummary(null)).toBeNull();
    expect(cloudSyncSummary(healthy)).toBeNull();
  });

  it('says when cloud sync failed, pointing at the details', () => {
    const report: CloudSyncReport = {
      ...healthy,
      lastFault: {fault: {operation: 'list', status: 200, reason: 'Not a file list', reply: '{"files":[]}'}, at_ms: AT_MS},
    };
    expect(cloudSyncSummary(report)).toBe(`Cloud sync failed at ${AT}; details below.`);
  });
});
