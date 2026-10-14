import {describe, expect, it} from 'vitest';
import {cloudSyncReportLines, cloudSyncSummary, type CloudAttemptOutcome, type CloudSyncReport} from '../../cloud/cloudSyncReport.js';
import {formatDateTime, formatTime} from '../../fields/format.js';

const AT_MS = Date.UTC(2026, 9, 14, 11, 0, 0);
const AT = formatDateTime(new Date(AT_MS));
const END_MS = AT_MS + 90_000;
const END = formatTime(new Date(END_MS));

describe('cloudSyncReportLines', () => {
  it('says cloud sync is off when this window has none', () => {
    expect(cloudSyncReportLines(null)).toEqual(['Cloud sync: not available in this window']);
  });

  it('a window that never connected says so, with no attempt and no error', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'none'}, lastAttempt: null, pendingChanges: 0, lastFault: null,
    };
    expect(cloudSyncReportLines(report)).toEqual([
      'Cloud sync: not connected',
      '  pending changes: 0',
      '  last attempt: none since the app opened',
      '  last error: none since the last successful sync',
    ]);
  });

  it('a connected window shows the account, the pending count and the last attempt', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'connected', account: 'john@example.com'},
      lastAttempt: {kind: 'ended', started_ms: AT_MS, ended_ms: END_MS, outcome: {kind: 'stopped', reason: 'offline'}},
      pendingChanges: 3,
      lastFault: null,
    };
    expect(cloudSyncReportLines(report)).toEqual([
      'Cloud sync: connected as john@example.com',
      '  pending changes: 3',
      `  last attempt: started ${AT}, ended ${END}, stopped: offline`,
      '  last error: none since the last successful sync',
    ]);
  });

  it('a window that must reconnect names the account', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'reconnect', account: 'john@example.com'},
      lastAttempt: {kind: 'ended', started_ms: AT_MS, ended_ms: END_MS, outcome: {kind: 'reconnect'}},
      pendingChanges: 1,
      lastFault: null,
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
      lastFault: null,
    };
    expect(cloudSyncReportLines(report)[2]).toBe(`  last attempt: running since ${AT}, 16 pushed so far`);
  });

  it('an account the sign-in did not name is said to be unavailable, never left blank', () => {
    const lines = (grant: CloudSyncReport['grant']): string =>
      cloudSyncReportLines({grant, lastAttempt: null, pendingChanges: 0, lastFault: null})[0] ?? '';
    expect(lines({kind: 'connected', account: ''})).toBe('Cloud sync: connected as Google account (name not available)');
    expect(lines({kind: 'reconnect', account: ''})).toBe('Cloud sync: must reconnect Google account (name not available)');
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
    ]);
  });

  it('names every attempt outcome in words', () => {
    const lineFor = (outcome: CloudAttemptOutcome): string =>
      cloudSyncReportLines({
        grant: {kind: 'none'}, lastAttempt: {kind: 'ended', started_ms: AT_MS, ended_ms: END_MS, outcome}, pendingChanges: 0, lastFault: null,
      })[2] ?? '';
    expect(lineFor({kind: 'synced'})).toBe(`  last attempt: started ${AT}, ended ${END}, synced`);
    expect(lineFor({kind: 'stopped', reason: 'quota'})).toBe(`  last attempt: started ${AT}, ended ${END}, stopped: Drive quota`);
    expect(lineFor({kind: 'notConnected'})).toBe(`  last attempt: started ${AT}, ended ${END}, not connected`);
    expect(lineFor({kind: 'refused', reason: 'noRoom'})).toBe(`  last attempt: started ${AT}, ended ${END}, refused: no room on Drive`);
    expect(lineFor({kind: 'refused', reason: 'bucketUnreadable'})).toBe(`  last attempt: started ${AT}, ended ${END}, refused: Drive folder unreadable`);
  });
});

describe('cloudSyncSummary', () => {
  const healthy: CloudSyncReport = {
    grant: {kind: 'connected', account: 'john@example.com'}, lastAttempt: null, pendingChanges: 0, lastFault: null,
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
