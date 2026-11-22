import type {UpdateContainer, UpdateRegistration, WaitingWorker} from './appUpdate.js';

/** A service worker host the browser suite drives by hand. The suite's build has no service worker, so
 *  `main.ts` hands `AppUpdate` this in a `--mode test` build and the specs script a waiting build.
 *  It is published through the test hooks only (testHooks.ts). */
export class ScriptedUpdateHost implements UpdateRegistration, UpdateContainer {
  waiting: WaitingWorker | null = null;
  readonly installing = null;
  private readonly changeListeners: Array<() => void> = [];

  constructor(readonly scope: string) {}

  /** How many times the app asked for a newer build. */
  checks = 0;

  update(): Promise<void> {
    this.checks += 1;
    return Promise.resolve();
  }

  unregister(): Promise<boolean> { return Promise.resolve(true); }

  addEventListener(type: 'updatefound' | 'controllerchange', listener: () => void): void {
    if (type === 'controllerchange') this.changeListeners.push(listener);
  }

  /** A new build has downloaded and waits. Told to skip waiting, it takes over at once. */
  deliverWaiting(): void {
    this.waiting = {
      postMessage: () => {
        this.waiting = null;
        for (const listener of this.changeListeners) listener();
      },
    };
  }
}
