import { describe, expect, it } from 'vitest';
import type { CloudSession } from '../../src/cloud/cloudStore.js';
import type { RunOutcome, SyncEngine } from '../../src/cloud/syncRun.js';
import type { AccountNamer } from '../../src/cloud/accountNamer.js';
import {
  createSyncScheduler,
  type RunLock,
  type SyncScheduler,
  type Timer,
} from '../../src/cloud/syncScheduler.js';

class FakeNamer implements AccountNamer {
  calls = 0;
  async nameIfUnknown(): Promise<void> {
    this.calls++;
  }
}

interface PendingTimer {
  readonly id: number;
  at: number;
  readonly fn: () => void;
  readonly intervalMs?: number;
}

class FakeTimer implements Timer {
  private now_ms = 0;
  private nextId = 1;
  private timers: PendingTimer[] = [];

  after(ms: number, f: () => void): () => void {
    const id = this.nextId++;
    this.timers.push({ id, at: this.now_ms + ms, fn: f });
    return () => {
      this.timers = this.timers.filter((t) => t.id !== id);
    };
  }

  every(ms: number, f: () => void): () => void {
    const id = this.nextId++;
    this.timers.push({ id, at: this.now_ms + ms, fn: f, intervalMs: ms });
    return () => {
      this.timers = this.timers.filter((t) => t.id !== id);
    };
  }

  advance(ms: number): void {
    const target = this.now_ms + ms;
    while (true) {
      let earliest: PendingTimer | null = null;
      for (const t of this.timers) {
        if (t.at <= target) {
          if (earliest === null || t.at < earliest.at) {
            earliest = t;
          }
        }
      }
      if (earliest === null) {
        break;
      }
      this.now_ms = earliest.at;
      if (earliest.intervalMs !== undefined) {
        earliest.at += earliest.intervalMs;
      } else {
        const idToRemove = earliest.id;
        this.timers = this.timers.filter((t) => t.id !== idToRemove);
      }
      earliest.fn();
    }
    this.now_ms = target;
  }
}

class InMemoryRunLock implements RunLock {
  private queue: Promise<void> = Promise.resolve();

  withLock<T>(_name: string, f: () => Promise<T>): Promise<T> {
    const previous = this.queue;
    let release: () => void = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    return previous.then(async () => {
      try {
        return await f();
      } finally {
        release();
      }
    });
  }
}

class FakeSyncEngine implements SyncEngine {
  runCount = 0;
  activeRuns = 0;
  maxConcurrentRuns = 0;
  pending = 0;
  private deferredRun: { resolve: (outcome: RunOutcome) => void; promise: Promise<RunOutcome> } | null = null;
  outcomeToReturn: RunOutcome = { kind: 'synced', pulled: 0, pushed: 0, conflicts: [], held: 0 };

  async run(): Promise<RunOutcome> {
    this.runCount++;
    this.activeRuns++;
    if (this.activeRuns > this.maxConcurrentRuns) {
      this.maxConcurrentRuns = this.activeRuns;
    }
    try {
      if (this.deferredRun !== null) {
        return await this.deferredRun.promise;
      }
      return this.outcomeToReturn;
    } finally {
      this.activeRuns--;
    }
  }

  deferNextRun(): { resolve: (outcome: RunOutcome) => void } {
    let resolver: (outcome: RunOutcome) => void = () => {};
    const promise = new Promise<RunOutcome>((resolve) => {
      resolver = resolve;
    });
    this.deferredRun = { resolve: resolver, promise };
    return {
      resolve: (outcome: RunOutcome) => {
        this.deferredRun = null;
        resolver(outcome);
      },
    };
  }

  pendingLocal(): number {
    return this.pending;
  }
}

class FakeCloudSession implements CloudSession {
  nameAccount(): void {}
  currentGrant: { kind: 'none' } | { kind: 'connected'; account: string } | { kind: 'reconnect'; account: string } = {
    kind: 'connected',
    account: 'john@example.com',
  };

  grant() {
    return this.currentGrant;
  }

  accessToken(): Promise<{ readonly kind: 'ok'; readonly token: string }> {
    return Promise.resolve({ kind: 'ok', token: 'fake-token' });
  }

  onBoot(): Promise<{ readonly kind: 'notACallback' }> {
    return Promise.resolve({ kind: 'notACallback' });
  }

  beginConnect(): void {}

  disconnect(): Promise<void> {
    this.currentGrant = { kind: 'none' };
    return Promise.resolve();
  }
}

function createHarness(options?: { isVisible?: boolean }) {
  const engine = new FakeSyncEngine();
  const session = new FakeCloudSession();
  const timer = new FakeTimer();
  const lock = new InMemoryRunLock();
  let visibleState = options?.isVisible ?? true;
  const outcomes: RunOutcome[] = [];
  const namer = new FakeNamer();

  const scheduler: SyncScheduler = createSyncScheduler({
    engine,
    session,
    namer,
    timer,
    lock,
    visible: () => visibleState,
    onOutcome: (outcome) => {
      outcomes.push(outcome);
    },
    debounce_ms: 3000,
    focusGap_ms: 30000,
    tick_ms: 60000,
  });

  return {
    engine,
    namer,
    session,
    timer,
    lock,
    scheduler,
    outcomes,
    setVisible: (v: boolean) => {
      visibleState = v;
    },
  };
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe('syncScheduler', () => {
  it('names the account before each run', async () => {
    const h = createHarness();
    let namedBeforeRun = false;
    const run = h.engine.run.bind(h.engine);
    h.engine.run = async () => {
      namedBeforeRun = h.namer.calls === 1;
      return run();
    };
    await h.scheduler.syncNow();
    expect(namedBeforeRun).toBe(true);
  });

  it('three saves in 3 s → one run', async () => {
    const h = createHarness();

    h.scheduler.onSave();
    h.timer.advance(1000);
    h.scheduler.onSave();
    h.timer.advance(1000);
    h.scheduler.onSave();

    // Only 2s since last save, no run yet
    expect(h.engine.runCount).toBe(0);

    // Advance 3s past last save
    h.timer.advance(3000);
    await flush();

    expect(h.engine.runCount).toBe(1);
    expect(h.outcomes.length).toBe(1);
  });

  it('run during run → one queued', async () => {
    const h = createHarness();
    const deferred1 = h.engine.deferNextRun();

    // Trigger run 1
    h.scheduler.onOpen();
    await flush();
    expect(h.engine.runCount).toBe(1);
    expect(h.engine.activeRuns).toBe(1);

    // While run 1 is active, make multiple requests
    h.scheduler.onSave();
    h.scheduler.onOpen();
    h.scheduler.onReconnect();

    // Still only run 1 in progress
    expect(h.engine.runCount).toBe(1);

    // Resolve run 1
    deferred1.resolve({ kind: 'synced', pulled: 1, pushed: 0, conflicts: [], held: 0 });
    await flush();

    // Exactly one more run was queued and executed
    expect(h.engine.runCount).toBe(2);
    expect(h.outcomes.length).toBe(2);
  });

  it('focus within 30 s → nothing', async () => {
    const h = createHarness();

    // Initial focus triggers run
    h.scheduler.onFocus();
    await flush();
    expect(h.engine.runCount).toBe(1);

    // Focus at 10s is ignored
    h.timer.advance(10000);
    h.scheduler.onFocus();
    await flush();
    expect(h.engine.runCount).toBe(1);

    // Focus at 25s is ignored
    h.timer.advance(15000);
    h.scheduler.onFocus();
    await flush();
    expect(h.engine.runCount).toBe(1);

    // Focus after 30s triggers run
    h.timer.advance(5001);
    h.scheduler.onFocus();
    await flush();
    expect(h.engine.runCount).toBe(2);
  });

  it('tick only while visible and never during a run', async () => {
    const h = createHarness({ isVisible: false });

    // Tick while hidden does nothing
    h.scheduler.onTick();
    await flush();
    expect(h.engine.runCount).toBe(0);

    h.timer.advance(60000);
    await flush();
    expect(h.engine.runCount).toBe(0);

    // Become visible
    h.setVisible(true);
    h.scheduler.onTick();
    await flush();
    expect(h.engine.runCount).toBe(1);

    // While a run is in progress, tick does NOT queue a run
    const deferred = h.engine.deferNextRun();
    h.scheduler.onOpen();
    await flush();
    expect(h.engine.runCount).toBe(2);

    // Tick during active run
    h.scheduler.onTick();
    h.timer.advance(60000);
    await flush();

    // Complete run 2
    deferred.resolve({ kind: 'synced', pulled: 0, pushed: 0, conflicts: [], held: 0 });
    await flush();

    // No queued run from the tick
    expect(h.engine.runCount).toBe(2);
  });

  it('two fake tabs sharing a lock never overlap', async () => {
    const lock = new InMemoryRunLock();
    const timer = new FakeTimer();

    const engine1 = new FakeSyncEngine();
    const session1 = new FakeCloudSession();
    const scheduler1 = createSyncScheduler({
      engine: engine1,
      session: session1,
      namer: new FakeNamer(),
      timer,
      lock,
      visible: () => true,
      onOutcome: () => {},
      debounce_ms: 3000,
      focusGap_ms: 30000,
      tick_ms: 60000,
    });

    const engine2 = new FakeSyncEngine();
    const session2 = new FakeCloudSession();
    const scheduler2 = createSyncScheduler({
      engine: engine2,
      session: session2,
      namer: new FakeNamer(),
      timer,
      lock,
      visible: () => true,
      onOutcome: () => {},
      debounce_ms: 3000,
      focusGap_ms: 30000,
      tick_ms: 60000,
    });

    let tab1Active = false;
    let tab2Active = false;
    let overlapDetected = false;

    const originalRun1 = engine1.run.bind(engine1);
    engine1.run = async () => {
      tab1Active = true;
      if (tab2Active) overlapDetected = true;
      const res = await originalRun1();
      tab1Active = false;
      return res;
    };

    const originalRun2 = engine2.run.bind(engine2);
    engine2.run = async () => {
      tab2Active = true;
      if (tab1Active) overlapDetected = true;
      const res = await originalRun2();
      tab2Active = false;
      return res;
    };

    const deferred1 = engine1.deferNextRun();

    // Tab 1 starts run
    const p1 = scheduler1.syncNow();
    await flush();
    expect(engine1.runCount).toBe(1);

    // Tab 2 starts run concurrently
    const p2 = scheduler2.syncNow();
    await flush();

    // Tab 2 has not started its engine run yet because Tab 1 holds the lock
    expect(engine2.runCount).toBe(0);

    // Finish Tab 1
    deferred1.resolve({ kind: 'synced', pulled: 0, pushed: 0, conflicts: [], held: 0 });
    await p1;

    // Now Tab 2 runs and finishes
    await p2;
    expect(engine2.runCount).toBe(1);

    expect(overlapDetected).toBe(false);
  });

  it('no run when session grant is none', async () => {
    const h = createHarness();
    h.session.currentGrant = { kind: 'none' };

    h.scheduler.onOpen();
    h.scheduler.onFocus();
    h.scheduler.onSave();
    h.scheduler.onReconnect();
    h.scheduler.onTick();
    await h.scheduler.syncNow();
    h.timer.advance(100000);
    await Promise.resolve();

    expect(h.engine.runCount).toBe(0);
  });
});
