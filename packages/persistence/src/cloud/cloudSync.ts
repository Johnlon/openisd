import type { CloudAttempt, CloudAttemptOutcome, CloudFault, CloudFaultRecord, CloudSyncReport, ConflictCopy, SyncStatus } from '@openisd/design/cloud';
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

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function attemptOutcome(outcome: RunOutcome): CloudAttemptOutcome {
    switch (outcome.kind) {
      case 'synced': return { kind: 'synced', left: outcome.left, removedDuplicates: outcome.removedDuplicates };
      case 'stopped': return { kind: 'stopped', reason: outcome.reason };
      case 'notConnected': return { kind: 'notConnected' };
      case 'reconnect': return { kind: 'reconnect' };
      case 'refused': return { kind: 'refused', reason: outcome.reason };
      case 'failed': return { kind: 'failed' };
    }
  }

  function onOutcome(outcome: RunOutcome): void {
    lastRunOutcome = outcome;
    const ended_ms = clock();
    const started_ms = lastAttempt?.kind === 'running' ? lastAttempt.started_ms : ended_ms;
    lastAttempt = { kind: 'ended', started_ms, ended_ms, outcome: attemptOutcome(outcome) };
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
        return {
          kind: 'offline',
          account,
          at_ms: lastSyncAt_ms,
          changes: pendingChanges(),
        };
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
      notify();
    },
    runStarted: () => {
      lastAttempt = { kind: 'running', started_ms: clock(), pushed: 0 };
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
    }),
  };
}
