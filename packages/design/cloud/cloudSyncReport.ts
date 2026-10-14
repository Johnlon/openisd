import {formatClock, formatDateTime, formatTime} from '../fields/format.js';
import type {CloudFault, CloudFaultRecord, CloudGrant} from './cloudTypes.js';
import {type ConflictCopy, conflictKeptText} from './syncStatus.js';

/** How a sync run ended, with its counts. A fault itself is in the report's `lastFault` and events. */
export type CloudAttemptOutcome =
  | { readonly kind: 'synced'; readonly pulled: number; readonly pushed: number; readonly left: number; readonly removedDuplicates: number }
  | { readonly kind: 'stopped'; readonly reason: 'offline' | 'quota'; readonly pushedSoFar: number }
  | { readonly kind: 'notConnected' }
  | { readonly kind: 'reconnect' }
  /** The whole-store backup taken before a destructive write did not fit: the copy, and what the store held. */
  | { readonly kind: 'refused'; readonly reason: 'noRoom'; readonly copyChars: number; readonly storeChars: number }
  | { readonly kind: 'refused'; readonly reason: 'bucketUnreadable' }
  | { readonly kind: 'failed' };

/** One thing cloud sync did, for the diagnostics log of this page session. */
export type CloudSyncEvent =
  | { readonly kind: 'started'; readonly at_ms: number }
  | { readonly kind: 'ended'; readonly at_ms: number; readonly outcome: CloudAttemptOutcome }
  | { readonly kind: 'error'; readonly at_ms: number; readonly fault: CloudFault }
  /** Drive held `count` files of a kind this build does not know; they were left alone. */
  | { readonly kind: 'skipped'; readonly at_ms: number; readonly count: number }
  /** A binned project came back to the list because another device edited it. */
  | { readonly kind: 'restoredFromBin'; readonly at_ms: number; readonly name: string; readonly editedOn: string }
  /** An item changed on two devices: both versions kept, this device's under the copy's name. */
  | { readonly kind: 'keptBoth'; readonly at_ms: number; readonly copy: ConflictCopy };

/** How many events the log keeps; older ones drop off. */
export const CLOUD_SYNC_EVENTS_KEPT = 30;

/** How much of a reply an event line shows. */
const REPLY_START_CHARS = 200;

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
  /** The last `CLOUD_SYNC_EVENTS_KEPT` events of this page session, newest first. */
  readonly events: readonly CloudSyncEvent[];
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

function refusalText(outcome: Extract<CloudAttemptOutcome, {kind: 'refused'}>): string {
  switch (outcome.reason) {
    case 'noRoom': return `refused: no room in this browser for the backup (copy ${outcome.copyChars} chars, store held ${outcome.storeChars} chars)`;
    case 'bucketUnreadable': return 'refused: a local store is unreadable';
  }
}

function outcomeText(outcome: CloudAttemptOutcome): string {
  switch (outcome.kind) {
    case 'synced': {
      const left = outcome.left === 0 ? '' : `, ${outcome.left} left`;
      const removed = outcome.removedDuplicates === 0 ? '' : `, removed ${outcome.removedDuplicates} duplicate copies`;
      return `synced, ${outcome.pulled} pulled, ${outcome.pushed} pushed${left}${removed}`;
    }
    case 'stopped': return `stopped: ${outcome.reason === 'offline' ? 'offline' : 'Drive quota'}, ${outcome.pushedSoFar} pushed`;
    case 'notConnected': return 'not connected';
    case 'reconnect': return 'must reconnect';
    case 'refused': return refusalText(outcome);
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

function eventLine(event: CloudSyncEvent): string {
  const at = formatClock(new Date(event.at_ms));
  switch (event.kind) {
    case 'started': return `    ${at} run started`;
    case 'ended': return `    ${at} run ended: ${outcomeText(event.outcome)}`;
    case 'error': {
      const {fault} = event;
      return `    ${at} error: ${fault.operation}, HTTP ${fault.status}, ${fault.reason}, reply: ${fault.reply.slice(0, REPLY_START_CHARS)}`;
    }
    case 'skipped': return `    ${at} skipped ${event.count} items of a newer kind`;
    case 'keptBoth': return `    ${at} ${conflictKeptText(event.copy)}; yours is "${event.copy.name}"`;
    case 'restoredFromBin': return `    ${at} restored from Bin: edited on ${event.editedOn === '' ? 'another device' : event.editedOn} ("${event.name}")`;
  }
}

function eventLines(events: readonly CloudSyncEvent[]): readonly string[] {
  if (events.length === 0) return ['  recent events: none since the page opened'];
  return ['  recent events, newest first:', ...events.map(eventLine)];
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
    ...eventLines(report.events),
  ];
}

/** The line the diagnostics summary shows when cloud sync holds an error; null when it holds none. */
export function cloudSyncSummary(report: CloudSyncReport | null): string | null {
  if (report === null || report.lastFault === null) return null;
  return `Cloud sync failed at ${formatDateTime(new Date(report.lastFault.at_ms))}; details below.`;
}
