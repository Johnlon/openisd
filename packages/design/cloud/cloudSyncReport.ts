import {formatDateTime, formatTime} from '../fields/format.js';
import type {CloudFaultRecord, CloudGrant} from './cloudTypes.js';

/** How the last sync run ended. The fault itself is in the report's `lastFault`. */
export type CloudAttemptOutcome =
  | { readonly kind: 'synced' }
  | { readonly kind: 'stopped'; readonly reason: 'offline' | 'quota' }
  | { readonly kind: 'notConnected' }
  | { readonly kind: 'reconnect' }
  | { readonly kind: 'refused'; readonly reason: 'noRoom' | 'bucketUnreadable' }
  | { readonly kind: 'failed' };

/** The last sync run: still running, with the pushes so far, or ended with its outcome. */
export type CloudAttempt =
  | { readonly kind: 'running'; readonly started_ms: number; readonly pushed: number }
  | { readonly kind: 'ended'; readonly started_ms: number; readonly ended_ms: number; readonly outcome: CloudAttemptOutcome };

/** What the diagnostics report says about cloud sync. */
export interface CloudSyncReport {
  readonly grant: CloudGrant;
  /** The last sync run since the app opened, or null when none has run. */
  readonly lastAttempt: CloudAttempt | null;
  readonly pendingChanges: number;
  /** Kept until the next successful sync. */
  readonly lastFault: CloudFaultRecord | null;
  /** Google refused to name the signed-in account; kept until disconnect. */
  readonly accountFault: CloudFaultRecord | null;
}

/** The sign-in does not name the account yet; the store then holds an empty name. */
function accountText(account: string): string {
  return account === '' ? 'Google account (name not available)' : account;
}

function grantText(grant: CloudGrant): string {
  switch (grant.kind) {
    case 'none': return 'not connected';
    case 'connected': return `connected as ${accountText(grant.account)}`;
    case 'reconnect': return `must reconnect ${accountText(grant.account)}`;
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
  const started = formatDateTime(new Date(attempt.started_ms));
  switch (attempt.kind) {
    case 'running': return `  last attempt: running since ${started}, ${attempt.pushed} pushed so far`;
    case 'ended': return `  last attempt: started ${started}, ended ${formatTime(new Date(attempt.ended_ms))}, ${outcomeText(attempt.outcome)}`;
  }
}

function accountFaultLines(record: CloudFaultRecord | null): readonly string[] {
  if (record === null) return [];
  const {fault} = record;
  return [`  account lookup failed: ${formatDateTime(new Date(record.at_ms))}, HTTP ${fault.status}, ${fault.reason}`];
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
    ...accountFaultLines(report.accountFault),
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
