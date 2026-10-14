import { CLOUD_SYNC_EVENTS_KEPT, type CloudAttempt, type CloudAttemptOutcome, type CloudFault, type CloudFaultRecord, type CloudSyncEvent, type CloudSyncReport, type ConflictCopy, type SyncStatus } from '@openisd/design/cloud';
import type { CloudSession } from './cloudStore.js';
import type { SyncLedger } from './syncLedger.js';
import type { RunOutcome, SyncEngine } from './syncRun.js';
import type { SyncScheduler } from './syncScheduler.js';

export interface CloudSync {
  status(): SyncStatus;
  conflicts(): ConflictCopy[];
  watch(onChange: () => void): () => void;
  connect(): void;
  reconnect(): void;
  disconnect(): Promise<void>;
  syncNow(): Promise<void>;
  conflictSeen(id: ConflictCopy['id']): void;
  onOutcome(outcome: RunOutcome): void;
  /** A run has started. */
  runStarted(): void;
  /** The running run has pushed `count` items so far. */
  runPushed(count: number): void;
  /** Google refused to name the signed-in account. */
  accountRefused(fault: CloudFault): void;
  /** A pulled edit took project `name` out of the Bin; `editedOn` names the device. */
  restoredFromBin(name: string, editedOn: string): void;
  /** The grant, the last run, the pending count and the last fault (kept until a run succeeds). */
  diagnostics(): CloudSyncReport;
}

export interface CloudSyncDeps {
  readonly session: CloudSession;
  readonly scheduler: SyncScheduler;
  readonly ledger: SyncLedger;
  readonly engine: SyncEngine;
  readonly now: () => number;
}

export function createCloudSync(deps: CloudSyncDeps): CloudSync {
  const clock = deps.now;
  let lastRunOutcome: RunOutcome | null = null;
  let lastSyncAt_ms: number | null = null;
  let lastFault: CloudFaultRecord | null = null;
  let lastAttempt: CloudAttempt | null = null;
  let accountFault: CloudFaultRecord | null = null;
  const listeners = new Set<() => void>();
  /** Newest first, at most CLOUD_SYNC_EVENTS_KEPT; this page session only, never stored. */
  let events: readonly CloudSyncEvent[] = [];

  function record(event: CloudSyncEvent): void {
    events = [event, ...events].slice(0, CLOUD_SYNC_EVENTS_KEPT);
  }

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function attemptOutcome(outcome: RunOutcome): CloudAttemptOutcome {
    switch (outcome.kind) {
      case 'synced': return { kind: 'synced', pulled: outcome.pulled, pushed: outcome.pushed, left: outcome.left, removedDuplicates: outcome.removedDuplicates };
      case 'stopped': return { kind: 'stopped', reason: outcome.reason, pushedSoFar: outcome.pushedSoFar };
      case 'notConnected': return { kind: 'notConnected' };
      case 'reconnect': return { kind: 'reconnect' };
      case 'refused':
        return outcome.reason === 'noRoom'
          ? { kind: 'refused', reason: 'noRoom', copyChars: outcome.shortfall.copyChars, storeChars: outcome.shortfall.storeChars }
          : { kind: 'refused', reason: 'bucketUnreadable' };
      case 'failed': return { kind: 'failed' };
    }
  }

  function onOutcome(outcome: RunOutcome): void {
    lastRunOutcome = outcome;
    const ended_ms = clock();
    const started_ms = lastAttempt?.kind === 'running' ? lastAttempt.started_ms : ended_ms;
    lastAttempt = { kind: 'ended', started_ms, ended_ms, outcome: attemptOutcome(outcome) };
    if (outcome.kind === 'failed') record({ kind: 'error', at_ms: ended_ms, fault: outcome.fault });
    if (outcome.kind === 'synced' && outcome.skippedNewer > 0) record({ kind: 'skipped', at_ms: ended_ms, count: outcome.skippedNewer });
    if (outcome.kind === 'synced') for (const copy of outcome.keptBoth) record({ kind: 'keptBoth', at_ms: copy.at_ms, copy });
    record({ kind: 'ended', at_ms: ended_ms, outcome: lastAttempt.outcome });
    if (outcome.kind === 'synced') {
      lastSyncAt_ms = clock();
      lastFault = null;
    }
    if (outcome.kind === 'failed') {
      lastFault = { fault: outcome.fault, at_ms: clock() };
    }
    notify();
  }

  function pendingChanges(): number {
    const local = deps.engine.pendingLocal();
    if (local > 0) {
      return local;
    }
    if (lastRunOutcome !== null) {
      switch (lastRunOutcome.kind) {
        case 'stopped':
        case 'reconnect':
        case 'refused':
        case 'failed':
          return lastRunOutcome.pendingLocal;
        case 'synced':
        case 'notConnected':
          break;
      }
    }
    return 0;
  }

  function status(): SyncStatus {
    const grant = deps.session.grant();
    if (grant.kind === 'none') {
      return { kind: 'off' };
    }

    if (grant.kind === 'reconnect') {
      return {
        kind: 'reconnect',
        account: grant.account,
        changes: pendingChanges(),
      };
    }

    const account = grant.account;

    if (lastAttempt?.kind === 'running') {
      return { kind: 'syncing', account };
    }

    if (lastRunOutcome === null) {
      const pending = pendingChanges();
      return {
        kind: 'pending',
        account,
        at_ms: null,
        changes: pending,
        nextAt_ms: deps.scheduler.nextRunAt(),
      };
    }

    switch (lastRunOutcome.kind) {
      case 'synced': {
        if (lastRunOutcome.held > 0) {
          return {
            kind: 'held',
            account,
            at_ms: lastSyncAt_ms,
            heldDocs: lastRunOutcome.held,
          };
        }
        const pending = deps.engine.pendingLocal();
        if (pending > 0) {
          return {
            kind: 'pending',
            account,
            at_ms: lastSyncAt_ms,
            changes: pending,
            nextAt_ms: deps.scheduler.nextRunAt(),
          };
        }
        return {
          kind: 'synced',
          account,
          at_ms: lastSyncAt_ms ?? clock(),
          conflicts: deps.ledger.conflicts().length,
        };
      }

      case 'stopped': {
        // Offline only when the browser says so (the request layer decides); Drive asking to
        // slow down is a wait for the next run, not a lost connection.
        switch (lastRunOutcome.reason) {
          case 'offline':
            return { kind: 'offline', account, at_ms: lastSyncAt_ms, changes: pendingChanges() };
          case 'quota':
            return { kind: 'pending', account, at_ms: lastSyncAt_ms, changes: pendingChanges(), nextAt_ms: deps.scheduler.nextRunAt() };
        }
        break;
      }

      case 'notConnected': {
        return { kind: 'off' };
      }

      case 'reconnect': {
        return {
          kind: 'reconnect',
          account,
          changes: pendingChanges(),
        };
      }

      case 'refused': {
        return {
          kind: 'refused',
          account,
          reason: lastRunOutcome.reason,
        };
      }

      case 'failed': {
        return {
          kind: 'failed',
          account,
          fault: lastRunOutcome.fault,
          retryAt_ms: deps.scheduler.nextRunAt(),
        };
      }
    }
  }

  function conflicts(): ConflictCopy[] {
    return deps.ledger.conflicts();
  }

  function watch(onChange: () => void): () => void {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }

  function connect(): void {
    deps.session.beginConnect('connect');
  }

  function reconnect(): void {
    deps.session.beginConnect('reconnect');
  }

  async function disconnect(): Promise<void> {
    await deps.session.disconnect();
    deps.ledger.forgetAll();
    lastRunOutcome = null;
    lastSyncAt_ms = null;
    lastAttempt = null;
    lastFault = null;
    accountFault = null;
    notify();
  }

  async function syncNow(): Promise<void> {
    await deps.scheduler.syncNow();
  }

  function conflictSeen(id: ConflictCopy['id']): void {
    deps.ledger.clearConflict(id);
    notify();
  }

  return {
    status,
    conflicts,
    watch,
    connect,
    reconnect,
    disconnect,
    syncNow,
    conflictSeen,
    onOutcome,
    accountRefused: (fault) => {
      accountFault = { fault, at_ms: clock() };
      record({ kind: 'error', at_ms: accountFault.at_ms, fault });
      notify();
    },
    restoredFromBin: (name, editedOn) => {
      record({ kind: 'restoredFromBin', at_ms: clock(), name, editedOn });
      notify();
    },
    runStarted: () => {
      lastAttempt = { kind: 'running', started_ms: clock(), pushed: 0 };
      record({ kind: 'started', at_ms: lastAttempt.started_ms });
      notify();
    },
    runPushed: (count) => {
      if (lastAttempt?.kind !== 'running') return;
      lastAttempt = { ...lastAttempt, pushed: count };
      notify();
    },
    diagnostics: () => ({
      grant: deps.session.grant(),
      lastAttempt,
      pendingChanges: pendingChanges(),
      lastFault,
      accountFault,
      events,
    }),
  };
}
