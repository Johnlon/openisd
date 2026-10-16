import {type Ref, readonly, ref} from 'vue';

/** The message the built worker answers by taking over (see vite.config.js: skipWaiting stays off
 *  in the worker, the page decides when). */
export interface SkipWaitingMessage {
  readonly type: 'SKIP_WAITING';
}

/** A downloaded new build, waiting for the page's say-so. */
export interface WaitingWorker {
  postMessage(message: SkipWaitingMessage): void;
}

/** A new build still downloading. */
export interface InstallingWorker {
  readonly state: ServiceWorkerState;
  addEventListener(type: 'statechange', listener: () => void): void;
}

/** The slice of the service worker registration this module uses. */
export interface UpdateRegistration {
  /** The registration's scope URL; the caches of this scope are named after it. */
  readonly scope: string;
  readonly waiting: WaitingWorker | null;
  readonly installing: InstallingWorker | null;
  update(): Promise<unknown>;
  unregister(): Promise<boolean>;
  addEventListener(type: 'updatefound', listener: () => void): void;
}

/** `navigator.serviceWorker`, as far as this module looks. */
export interface UpdateContainer {
  addEventListener(type: 'controllerchange', listener: () => void): void;
}

/** Tells when the page comes back into view. */
export interface VisibilitySource {
  onVisible(listener: () => void): void;
}

/** Calls a listener at a fixed interval for as long as the page lives. */
export interface UpdateTimer {
  every(ms: number, listener: () => void): void;
}

/** The browser's named caches. */
export interface CacheStore {
  keys(): Promise<string[]>;
  delete(name: string): Promise<boolean>;
}

export interface AppUpdateDeps {
  readonly container: UpdateContainer;
  readonly visibility: VisibilitySource;
  readonly timer: UpdateTimer;
  /** Some open project has edits that are not saved. */
  readonly anyUnsaved: () => boolean;
  readonly reload: () => void;
  readonly caches: CacheStore;
}

/** Where the running page stands against the deployed build. */
export type UpdateState =
  | {readonly kind: 'current'}
  | {readonly kind: 'offered'}
  | {readonly kind: 'dismissed'}
  | {readonly kind: 'switching'};

export const HOURLY_MS = 60 * 60 * 1000;

const SKIP_WAITING: SkipWaitingMessage = {type: 'SKIP_WAITING'};

/** Keeps the running build in step with the deployed one. */
export class AppUpdate {
  private readonly current = ref<UpdateState>({kind: 'current'});
  /** What the UI shows. */
  readonly state: Readonly<Ref<UpdateState>> = readonly(this.current);
  /** The waiting worker the user was offered, or dismissed. A different one is a newer build. */
  private pending: WaitingWorker | null = null;
  private reloaded = false;
  /** Null until the worker is registered (or for good where it cannot be). */
  private registration: UpdateRegistration | null = null;

  constructor(private readonly deps: AppUpdateDeps) {}

  /** Starts watching a registration, and checks once. */
  async attach(registration: UpdateRegistration): Promise<void> {
    this.registration = registration;
    const {container, visibility, timer} = this.deps;
    container.addEventListener('controllerchange', () => this.onControllerChange());
    registration.addEventListener('updatefound', () => this.watchInstalling());
    visibility.onVisible(() => void this.check());
    timer.every(HOURLY_MS, () => void this.check());
    await this.check();
  }

  /** Asks for a newer build (a failure is quiet), then looks at what waits. */
  async check(): Promise<void> {
    if (this.registration === null) return;
    try {
      await this.registration.update();
    } catch {
      // Offline or blocked: the next check tries again.
    }
    this.look();
  }

  /** The user chose Reload on the offer. */
  acceptOffer(): void {
    if (this.pending !== null) this.switchTo(this.pending);
    else this.reloadOnce();
  }

  /** The user chose Not now: quiet for this session, until a newer build waits. */
  dismiss(): void {
    this.current.value = {kind: 'dismissed'};
  }

  /** Loads the newest build whatever state the worker is in. Projects, drivers and settings stay: only
   *  this scope's worker and caches go. */
  async forceRefresh(): Promise<void> {
    const {registration} = this;
    if (registration !== null) {
      try {
        await registration.update();
      } catch {
        // Carry on: the caches go anyway.
      }
      await registration.unregister();
      const {caches} = this.deps;
      const names = await caches.keys();
      await Promise.all(names.filter(name => name.endsWith(registration.scope)).map(name => caches.delete(name)));
    }
    this.deps.reload();
  }

  private look(): void {
    const waiting = this.registration?.waiting ?? null;
    if (waiting === null) return;
    const held = this.current.value.kind === 'dismissed' || this.current.value.kind === 'switching';
    if (waiting === this.pending && held) return;
    this.pending = waiting;
    if (this.deps.anyUnsaved()) this.current.value = {kind: 'offered'};
    else this.switchTo(waiting);
  }

  private switchTo(worker: WaitingWorker): void {
    this.current.value = {kind: 'switching'};
    worker.postMessage(SKIP_WAITING);
  }

  private watchInstalling(): void {
    const installing = this.registration?.installing ?? null;
    if (installing === null) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed') this.look();
    });
  }

  /** The new build took over: this page, or another tab of the app, told it to. Either way this page
   *  still runs the old build, whose files the new worker no longer holds. */
  private onControllerChange(): void {
    if (this.current.value.kind === 'switching' || !this.deps.anyUnsaved()) {
      this.reloadOnce();
      return;
    }
    // Another tab switched while this one has unsaved edits: offer the reload, nothing left to skip.
    this.pending = null;
    this.current.value = {kind: 'offered'};
  }

  private reloadOnce(): void {
    if (this.reloaded) return;
    this.reloaded = true;
    this.deps.reload();
  }
}
