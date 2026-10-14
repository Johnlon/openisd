import { describe, expect, it } from 'vitest';
import {
  type ConflictCopy,
  DeviceId,
  ProjectId,
} from '@openisd/design/cloud';
import type { CloudSession } from '../../src/cloud/cloudStore.js';
import { createCloudSync, type CloudSync } from '../../src/cloud/cloudSync.js';
import type { LedgerRow, SyncLedger } from '../../src/cloud/syncLedger.js';
import type { RunOutcome, SyncEngine } from '../../src/cloud/syncRun.js';
import type { SyncScheduler } from '../../src/cloud/syncScheduler.js';

class FakeCloudSession implements CloudSession {
  currentGrant: { kind: 'none' } | { kind: 'connected'; account: string } | { kind: 'reconnect'; account: string } = {
    kind: 'connected',
    account: 'john@example.com',
  };
  connectCalls: string[] = [];
  disconnectCalls = 0;

  grant() {
    return this.currentGrant;
  }

  accessToken(): Promise<{ readonly kind: 'ok'; readonly token: string }> {
    return Promise.resolve({ kind: 'ok', token: 'fake-token' });
  }

  onBoot(): Promise<{ readonly kind: 'notACallback' }> {
    return Promise.resolve({ kind: 'notACallback' });
  }

  beginConnect(reason: 'connect' | 'reconnect'): void {
    this.connectCalls.push(reason);
  }

  disconnect(): Promise<void> {
    this.disconnectCalls++;
    this.currentGrant = { kind: 'none' };
    return Promise.resolve();
  }
}

class FakeSyncScheduler implements SyncScheduler {
  syncNowCalls = 0;

  onOpen(): void {}
  onFocus(): void {}
  onSave(): void {}
  onReconnect(): void {}
  onTick(): void {}

  syncNow(): Promise<void> {
    this.syncNowCalls++;
    return Promise.resolve();
  }
}

class FakeSyncLedger implements SyncLedger {
  private storedConflicts: ConflictCopy[] = [];
  forgetAllCalls = 0;

  rows(): LedgerRow[] {
    return [];
  }
  row(): LedgerRow | null {
    return null;
  }
  set(): void {}
  drop(): void {}
  cursor() {
    return null;
  }
  setCursor(): void {}
  deviceId(): DeviceId {
    const id = DeviceId.of('dev-1');
    if (id === null) throw new Error('invalid id');
    return id;
  }
  observe(): void {}
  nextSeq(): number {
    return 1;
  }
  conflicts(): ConflictCopy[] {
    return this.storedConflicts;
  }
  addConflict(c: ConflictCopy): void {
    this.storedConflicts.push(c);
  }
  clearConflict(id: ConflictCopy['id']): void {
    this.storedConflicts = this.storedConflicts.filter((c) => c.id.text !== id.text);
  }
  forgetAll(): void {
    this.forgetAllCalls++;
    this.storedConflicts = [];
  }
}

class FakeSyncEngine implements SyncEngine {
  pending = 0;

  async run(): Promise<RunOutcome> {
    return { kind: 'synced', pulled: 0, pushed: 0, conflicts: [], held: 0 };
  }

  pendingLocal(): number {
    return this.pending;
  }
}

function makeConflict(uuid: string, name: string): ConflictCopy {
  const id = ProjectId.of(uuid);
  const from = DeviceId.of('device-remote');
  if (id === null || from === null) throw new Error('invalid id');
  return {
    id,
    name,
    from,
    at_ms: 1700000000000,
  };
}

describe('cloudSync', () => {
  it('status() maps each RunOutcome kind', () => {
    let nowTime = 1000;
    const session = new FakeCloudSession();
    const scheduler = new FakeSyncScheduler();
    const ledger = new FakeSyncLedger();
    const engine = new FakeSyncEngine();

    const sync: CloudSync = createCloudSync({
      session,
      scheduler,
      ledger,
      engine,
      now: () => nowTime,
    });

    // Initial state before run
    expect(sync.status()).toEqual({
      kind: 'pending',
      account: 'john@example.com',
      at_ms: null,
      changes: 0,
    });

    // 1. synced outcome (no held, no pending, no conflicts)
    nowTime = 2000;
    sync.onOutcome({
      kind: 'synced',
      pulled: 1,
      pushed: 0,
      conflicts: [],
      held: 0,
    });
    expect(sync.status()).toEqual({
      kind: 'synced',
      account: 'john@example.com',
      at_ms: 2000,
      conflicts: 0,
    });

    // 1b. synced with conflicts in ledger
    ledger.addConflict(makeConflict('p-1', 'Sub 12'));
    expect(sync.status()).toEqual({
      kind: 'synced',
      account: 'john@example.com',
      at_ms: 2000,
      conflicts: 1,
    });

    // 1c. synced outcome with held docs > 0
    sync.onOutcome({
      kind: 'synced',
      pulled: 0,
      pushed: 0,
      conflicts: [],
      held: 3,
    });
    expect(sync.status()).toEqual({
      kind: 'held',
      account: 'john@example.com',
      at_ms: 2000,
      heldDocs: 3,
    });

    // 1d. synced outcome with pendingLocal > 0
    engine.pending = 2;
    sync.onOutcome({
      kind: 'synced',
      pulled: 0,
      pushed: 0,
      conflicts: [],
      held: 0,
    });
    expect(sync.status()).toEqual({
      kind: 'pending',
      account: 'john@example.com',
      at_ms: 2000,
      changes: 2,
    });
    engine.pending = 0;

    // 2. stopped outcome (maps to offline)
    sync.onOutcome({
      kind: 'stopped',
      reason: 'offline',
      pushedSoFar: 0,
      pendingLocal: 4,
    });
    expect(sync.status()).toEqual({
      kind: 'offline',
      account: 'john@example.com',
      at_ms: 2000,
      changes: 4,
    });

    // 3. notConnected outcome
    sync.onOutcome({ kind: 'notConnected' });
    expect(sync.status()).toEqual({
      kind: 'off',
    });

    // 4. reconnect outcome
    sync.onOutcome({
      kind: 'reconnect',
      pendingLocal: 5,
    });
    expect(sync.status()).toEqual({
      kind: 'reconnect',
      account: 'john@example.com',
      changes: 5,
    });

    // 5. refused outcome (noRoom)
    sync.onOutcome({
      kind: 'refused',
      reason: 'noRoom',
      pendingLocal: 1,
    });
    expect(sync.status()).toEqual({
      kind: 'refused',
      account: 'john@example.com',
      reason: 'noRoom',
    });

    // 5b. refused outcome (bucketUnreadable)
    sync.onOutcome({
      kind: 'refused',
      reason: 'bucketUnreadable',
      pendingLocal: 1,
    });
    expect(sync.status()).toEqual({
      kind: 'refused',
      account: 'john@example.com',
      reason: 'bucketUnreadable',
    });

    // 6. failed outcome
    const fault = { operation: 'list' as const, status: 500, reason: 'backendError', reply: '{"error":{}}' };
    sync.onOutcome({
      kind: 'failed',
      fault,
      pendingLocal: 2,
    });
    expect(sync.status()).toEqual({
      kind: 'failed',
      account: 'john@example.com',
      fault,
    });
    expect(sync.lastFault()?.fault).toEqual(fault);

    // 7. the fault is kept until a run succeeds
    sync.onOutcome({ kind: 'synced', pulled: 0, pushed: 0, conflicts: [], held: 0 });
    expect(sync.lastFault()).toBeNull();
  });

  it('disconnect clears to off', async () => {
    const session = new FakeCloudSession();
    const scheduler = new FakeSyncScheduler();
    const ledger = new FakeSyncLedger();
    const engine = new FakeSyncEngine();

    const sync = createCloudSync({
      session,
      scheduler,
      ledger,
      engine,
      now: () => 0,
    });

    sync.onOutcome({
      kind: 'synced',
      pulled: 1,
      pushed: 0,
      conflicts: [],
      held: 0,
    });
    expect(sync.status().kind).toBe('synced');

    let notified = false;
    sync.watch(() => {
      notified = true;
    });

    await sync.disconnect();

    expect(session.disconnectCalls).toBe(1);
    expect(ledger.forgetAllCalls).toBe(1);
    expect(session.grant().kind).toBe('none');
    expect(sync.status()).toEqual({ kind: 'off' });
    expect(notified).toBe(true);
  });

  it('conflicts and conflictSeen', () => {
    const session = new FakeCloudSession();
    const scheduler = new FakeSyncScheduler();
    const ledger = new FakeSyncLedger();
    const engine = new FakeSyncEngine();

    const c1 = makeConflict('c-1', 'Conflict Project 1');
    ledger.addConflict(c1);

    const sync = createCloudSync({
      session,
      scheduler,
      ledger,
      engine,
      now: () => 0,
    });

    expect(sync.conflicts()).toEqual([c1]);

    let notified = false;
    sync.watch(() => {
      notified = true;
    });

    sync.conflictSeen(c1.id);
    expect(sync.conflicts()).toEqual([]);
    expect(notified).toBe(true);
  });

  it('connect, reconnect, and syncNow forward to collaborators', async () => {
    const session = new FakeCloudSession();
    const scheduler = new FakeSyncScheduler();
    const ledger = new FakeSyncLedger();
    const engine = new FakeSyncEngine();

    const sync = createCloudSync({
      session,
      scheduler,
      ledger,
      engine,
      now: () => 0,
    });

    sync.connect();
    expect(session.connectCalls).toEqual(['connect']);

    sync.reconnect();
    expect(session.connectCalls).toEqual(['connect', 'reconnect']);

    await sync.syncNow();
    expect(scheduler.syncNowCalls).toBe(1);
  });

  it('watch unsubscribe stops notifications', () => {
    const session = new FakeCloudSession();
    const scheduler = new FakeSyncScheduler();
    const ledger = new FakeSyncLedger();
    const engine = new FakeSyncEngine();

    const sync = createCloudSync({
      session,
      scheduler,
      ledger,
      engine,
      now: () => 0,
    });

    let calls = 0;
    const unwatch = sync.watch(() => {
      calls++;
    });

    sync.onOutcome({ kind: 'synced', pulled: 0, pushed: 0, conflicts: [], held: 0 });
    expect(calls).toBe(1);

    unwatch();
    sync.onOutcome({ kind: 'synced', pulled: 0, pushed: 0, conflicts: [], held: 0 });
    expect(calls).toBe(1);
  });
});
