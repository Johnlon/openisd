import {formatDateTime} from '../fields/format.js';
import type {CloudFaultRecord, CloudGrant} from './cloudTypes.js';

/** How the last sync run ended. The fault itself is in the report's `lastFault`. */
export type CloudAttemptOutcome =
  | { readonly kind: 'synced' }
  | { readonly kind: 'stopped'; readonly reason: 'offline' | 'quota' }
  | { readonly kind: 'notConnected' }
  | { readonly kind: 'reconnect' }
  | { readonly kind: 'refused'; readonly reason: 'noRoom' | 'bucketUnreadable' }
  | { readonly kind: 'failed' };

export interface CloudAttempt {
  readonly at_ms: number;
  readonly outcome: CloudAttemptOutcome;
}

/** What the diagnostics report says about cloud sync. */
export interface CloudSyncReport {
  readonly grant: CloudGrant;
  /** The last sync run since the app opened, or null when none has run. */
  readonly lastAttempt: CloudAttempt | null;
  readonly pendingChanges: number;
  /** Kept until the next successful sync. */
  readonly lastFault: CloudFaultRecord | null;
}

function grantText(grant: CloudGrant): string {
  switch (grant.kind) {
    case 'none': return 'not connected';
    case 'connected': return `connected as ${grant.account}`;
    case 'reconnect': return `must reconnect ${grant.account}`;
  }
}

function outcomeText(outcome: CloudAttemptOutcome): string {
  switch (outcome.kind) {
    case 'synced': return 'synced';
    case 'stopped': return outcome.reason === 'offline' ? 'stopped: offline' : 'stopped: Drive quota';
    case 'notConnected': return 'not connected';
    case 'reconnect': return 'must reconnect';
    case 'refused': return outcome.reason === 'noRoom' ? 'refused: no room on Drive' : 'refused: Drive folder unreadable';
    case 'failed': return 'failed';
  }
}

function attemptLine(attempt: CloudAttempt | null): string {
  if (attempt === null) return '  last attempt: none since the app opened';
  return `  last attempt: ${formatDateTime(new Date(attempt.at_ms))}, ${outcomeText(attempt.outcome)}`;
}

function faultLines(record: CloudFaultRecord | null): readonly string[] {
  if (record === null) return ['  last error: none since the last successful sync'];
  const {fault} = record;
  return [
    `  last error: ${formatDateTime(new Date(record.at_ms))}`,
    `    request: ${fault.operation}`,
    `    HTTP status: ${fault.status}`,
    `    reason: ${fault.reason}`,
    `    reply: ${fault.reply}`,
  ];
}

/** The Cloud sync block of the diagnostics report; null when this window has no cloud sync. */
export function cloudSyncReportLines(report: CloudSyncReport | null): readonly string[] {
  if (report === null) return ['Cloud sync: not available in this window'];
  return [
    `Cloud sync: ${grantText(report.grant)}`,
    `  pending changes: ${report.pendingChanges}`,
    attemptLine(report.lastAttempt),
    ...faultLines(report.lastFault),
  ];
}

/** The line the diagnostics summary shows when cloud sync holds an error; null when it holds none. */
export function cloudSyncSummary(report: CloudSyncReport | null): string | null {
  if (report === null || report.lastFault === null) return null;
  return `Cloud sync failed at ${formatDateTime(new Date(report.lastFault.at_ms))}; details below.`;
}
