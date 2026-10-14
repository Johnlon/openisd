import type { CloudSession } from './cloudStore.js';
import type { AccountNamer } from './accountNamer.js';
import type { RunOutcome, SyncEngine } from './syncRun.js';

export interface SyncTriggers {
  onOpen(): void;
  onFocus(): void;
  onSave(): void;
  onReconnect(): void;
  onTick(): void;
}

export interface Timer {
  after(ms: number, f: () => void): () => void;
  every(ms: number, f: () => void): () => void;
}

export interface RunLock {
  withLock<T>(name: string, f: () => Promise<T>): Promise<T>;
}

export interface SyncSchedulerDeps {
  readonly engine: SyncEngine;
  readonly session: CloudSession;
  /** Names an unnamed account before each run. */
  readonly namer: AccountNamer;
  readonly timer: Timer;
  readonly lock: RunLock;
  readonly visible: () => boolean;
  readonly onOutcome: (outcome: RunOutcome) => void;
  readonly debounce_ms: number;
  readonly focusGap_ms: number;
  readonly tick_ms: number;
}

export type SyncScheduler = SyncTriggers & {
  syncNow(): Promise<void>;
};

export function createSyncScheduler(deps: SyncSchedulerDeps): SyncScheduler {
  let running = false;
  let queued = false;
  let saveTimerCancel: (() => void) | null = null;
  let focusCooldown = false;

  let queuedResolvers: (() => void)[] = [];
  let queuedRejecters: ((err: unknown) => void)[] = [];

  async function executeOneRun(): Promise<void> {
    await deps.lock.withLock('openisd-cloud-sync', async () => {
      if (deps.session.grant().kind === 'none') {
        return;
      }
      await deps.namer.nameIfUnknown();
      const outcome = await deps.engine.run();
      deps.onOutcome(outcome);
    });
  }

  function requestRun(): Promise<void> {
    if (deps.session.grant().kind === 'none') {
      return Promise.resolve();
    }

    if (running) {
      queued = true;
      return new Promise<void>((resolve, reject) => {
        queuedResolvers.push(resolve);
        queuedRejecters.push(reject);
      });
    }

    running = true;
    return (async () => {
      try {
        await executeOneRun();
        while (queued) {
          if (deps.session.grant().kind === 'none') {
            queued = false;
            const resolvers = queuedResolvers;
            queuedResolvers = [];
            queuedRejecters = [];
            for (const r of resolvers) {
              r();
            }
            break;
          }
          queued = false;
          const resolvers = queuedResolvers;
          const rejecters = queuedRejecters;
          queuedResolvers = [];
          queuedRejecters = [];
          try {
            await executeOneRun();
            for (const r of resolvers) {
              r();
            }
          } catch (err) {
            for (const rej of rejecters) {
              rej(err);
            }
            throw err;
          }
        }
      } finally {
        running = false;
      }
    })();
  }

  function onOpen(): void {
    if (deps.session.grant().kind === 'none') {
      return;
    }
    void requestRun();
  }

  function onFocus(): void {
    if (deps.session.grant().kind === 'none') {
      return;
    }
    if (focusCooldown) {
      return;
    }
    focusCooldown = true;
    deps.timer.after(deps.focusGap_ms, () => {
      focusCooldown = false;
    });
    void requestRun();
  }

  function onSave(): void {
    if (deps.session.grant().kind === 'none') {
      return;
    }
    if (saveTimerCancel !== null) {
      saveTimerCancel();
      saveTimerCancel = null;
    }
    saveTimerCancel = deps.timer.after(deps.debounce_ms, () => {
      saveTimerCancel = null;
      if (deps.session.grant().kind !== 'none') {
        void requestRun();
      }
    });
  }

  function onReconnect(): void {
    if (deps.session.grant().kind === 'none') {
      return;
    }
    void requestRun();
  }

  function onTick(): void {
    if (deps.session.grant().kind === 'none') {
      return;
    }
    if (!deps.visible()) {
      return;
    }
    if (running) {
      return;
    }
    void requestRun();
  }

  function syncNow(): Promise<void> {
    if (deps.session.grant().kind === 'none') {
      return Promise.resolve();
    }
    return requestRun();
  }

  deps.timer.every(deps.tick_ms, () => {
    onTick();
  });

  return {
    onOpen,
    onFocus,
    onSave,
    onReconnect,
    onTick,
    syncNow,
  };
}
