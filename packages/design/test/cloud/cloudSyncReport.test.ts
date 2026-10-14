import {describe, expect, it} from 'vitest';
import {cloudSyncReportLines, cloudSyncSummary, type CloudSyncReport} from '../../cloud/cloudSyncReport.js';
import {formatDateTime} from '../../fields/format.js';

const AT_MS = Date.UTC(2026, 9, 14, 11, 0, 0);
const AT = formatDateTime(new Date(AT_MS));

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
      lastAttempt: {at_ms: AT_MS, outcome: {kind: 'stopped', reason: 'offline'}},
      pendingChanges: 3,
      lastFault: null,
    };
    expect(cloudSyncReportLines(report)).toEqual([
      'Cloud sync: connected as john@example.com',
      '  pending changes: 3',
      `  last attempt: ${AT}, stopped: offline`,
      '  last error: none since the last successful sync',
    ]);
  });

  it('a window that must reconnect names the account', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'reconnect', account: 'john@example.com'},
      lastAttempt: {at_ms: AT_MS, outcome: {kind: 'reconnect'}},
      pendingChanges: 1,
      lastFault: null,
    };
    expect(cloudSyncReportLines(report).slice(0, 3)).toEqual([
      'Cloud sync: must reconnect john@example.com',
      '  pending changes: 1',
      `  last attempt: ${AT}, must reconnect`,
    ]);
  });

  it('the last error is shown in full', () => {
    const report: CloudSyncReport = {
      grant: {kind: 'connected', account: 'john@example.com'},
      lastAttempt: {at_ms: AT_MS, outcome: {kind: 'failed'}},
      pendingChanges: 2,
      lastFault: {
        fault: {operation: 'list', status: 200, reason: 'Not a file list', reply: '{"files":[]}'},
        at_ms: AT_MS,
      },
    };
    expect(cloudSyncReportLines(report)).toEqual([
      'Cloud sync: connected as john@example.com',
      '  pending changes: 2',
      `  last attempt: ${AT}, failed`,
      `  last error: ${AT}`,
      '    request: list',
      '    HTTP status: 200',
      '    reason: Not a file list',
      '    reply: {"files":[]}',
    ]);
  });

  it('names every attempt outcome in words', () => {
    const lineFor = (outcome: NonNullable<CloudSyncReport['lastAttempt']>['outcome']): string =>
      cloudSyncReportLines({
        grant: {kind: 'none'}, lastAttempt: {at_ms: AT_MS, outcome}, pendingChanges: 0, lastFault: null,
      })[2] ?? '';
    expect(lineFor({kind: 'synced'})).toBe(`  last attempt: ${AT}, synced`);
    expect(lineFor({kind: 'stopped', reason: 'quota'})).toBe(`  last attempt: ${AT}, stopped: Drive quota`);
    expect(lineFor({kind: 'notConnected'})).toBe(`  last attempt: ${AT}, not connected`);
    expect(lineFor({kind: 'refused', reason: 'noRoom'})).toBe(`  last attempt: ${AT}, refused: no room on Drive`);
    expect(lineFor({kind: 'refused', reason: 'bucketUnreadable'})).toBe(`  last attempt: ${AT}, refused: Drive folder unreadable`);
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
