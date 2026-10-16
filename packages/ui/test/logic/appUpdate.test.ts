import {describe, expect, it, vi} from 'vitest';
import {
  AppUpdate, HOURLY_MS,
  type CacheStore, type InstallingWorker, type UpdateContainer, type UpdateRegistration, type WaitingWorker,
} from '../../src/logic/appUpdate.js';

class FakeWaiting implements WaitingWorker {
  readonly posted: unknown[] = [];
  postMessage(message: {type: 'SKIP_WAITING'}): void { this.posted.push(message); }
}

class FakeInstalling implements InstallingWorker {
  state: 'installing' | 'installed' = 'installing';
  private listener: () => void = () => undefined;
  addEventListener(_type: 'statechange', listener: () => void): void { this.listener = listener; }
  become(state: 'installed'): void { this.state = state; this.listener(); }
}

class FakeRegistration implements UpdateRegistration {
  waiting: FakeWaiting | null = null;
  installing: FakeInstalling | null = null;
  updates = 0;
  updateFails = false;
  unregistered = 0;
  private found: () => void = () => undefined;
  constructor(readonly scope: string) {}
  update(): Promise<void> {
    this.updates += 1;
    return this.updateFails ? Promise.reject(new Error('offline')) : Promise.resolve();
  }
  unregister(): Promise<boolean> { this.unregistered += 1; return Promise.resolve(true); }
  addEventListener(_type: 'updatefound', listener: () => void): void { this.found = listener; }
  updateFound(): void { this.found(); }
}

class FakeContainer implements UpdateContainer {
  private changed: () => void = () => undefined;
  addEventListener(_type: 'controllerchange', listener: () => void): void { this.changed = listener; }
  controllerChange(): void { this.changed(); }
}

class FakeCaches implements CacheStore {
  readonly deleted: string[] = [];
  constructor(private readonly names: string[]) {}
  keys(): Promise<string[]> { return Promise.resolve(this.names); }
  delete(name: string): Promise<boolean> { this.deleted.push(name); return Promise.resolve(true); }
}

const SCOPE = 'https://x.test/test/';

function build(unsaved = false, cacheNames: string[] = []) {
  const registration = new FakeRegistration(SCOPE);
  const container = new FakeContainer();
  const caches = new FakeCaches(cacheNames);
  let visible: () => void = () => undefined;
  let tick: {ms: number; run: () => void} = {ms: 0, run: () => undefined};
  const reload = vi.fn();
  const flags = {unsaved};
  const update = new AppUpdate({
    container, caches, reload,
    visibility: {onVisible: l => { visible = l; }},
    timer: {every: (ms, run) => { tick = {ms, run}; }},
    anyUnsaved: () => flags.unsaved,
  });
  return {update, registration, container, caches, reload, flags, becomeVisible: () => visible(), tick: () => tick};
}

const settle = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe('AppUpdate', () => {
  it('has nothing to check before a worker is registered', async () => {
    const t = build();
    await t.update.check();
    expect(t.update.state.value).toEqual({kind: 'current'});
  });

  it('forceRefresh with no worker just reloads', async () => {
    const t = build();
    await t.update.forceRefresh();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('is current when no worker waits', async () => {
    const t = build();
    await t.update.attach(t.registration);
    expect(t.update.state.value).toEqual({kind: 'current'});
    expect(t.registration.updates).toBe(1);
  });

  it('switches at once when a worker already waits and nothing is unsaved', async () => {
    const t = build();
    const w = new FakeWaiting();
    t.registration.waiting = w;
    await t.update.attach(t.registration);
    expect(w.posted).toEqual([{type: 'SKIP_WAITING'}]);
    expect(t.update.state.value).toEqual({kind: 'switching'});
    expect(t.reload).not.toHaveBeenCalled();
  });

  it('reloads once on controllerchange while switching', async () => {
    const t = build();
    t.registration.waiting = new FakeWaiting();
    await t.update.attach(t.registration);
    t.container.controllerChange();
    t.container.controllerChange();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('reloads when another tab switched builds and nothing is unsaved here', async () => {
    const t = build();
    await t.update.attach(t.registration);
    t.container.controllerChange();
    t.container.controllerChange();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('offers a reload when another tab switched builds and edits are unsaved here', async () => {
    const t = build(true);
    await t.update.attach(t.registration);
    t.container.controllerChange();
    expect(t.reload).not.toHaveBeenCalled();
    expect(t.update.state.value).toEqual({kind: 'offered'});
    t.update.acceptOffer();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('offers, and does not switch, when edits are unsaved', async () => {
    const t = build(true);
    const w = new FakeWaiting();
    t.registration.waiting = w;
    await t.update.attach(t.registration);
    expect(t.update.state.value).toEqual({kind: 'offered'});
    expect(w.posted).toEqual([]);
  });

  it('acceptOffer skips waiting and reloads on controllerchange', async () => {
    const t = build(true);
    const w = new FakeWaiting();
    t.registration.waiting = w;
    await t.update.attach(t.registration);
    t.update.acceptOffer();
    expect(w.posted).toEqual([{type: 'SKIP_WAITING'}]);
    expect(t.update.state.value).toEqual({kind: 'switching'});
    t.container.controllerChange();
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('dismiss holds for the same worker and offers again for a newer one', async () => {
    const t = build(true);
    const first = new FakeWaiting();
    t.registration.waiting = first;
    await t.update.attach(t.registration);
    t.update.dismiss();
    expect(t.update.state.value).toEqual({kind: 'dismissed'});
    t.becomeVisible();
    await settle();
    expect(t.update.state.value).toEqual({kind: 'dismissed'});
    t.registration.waiting = new FakeWaiting();
    t.becomeVisible();
    await settle();
    expect(t.update.state.value).toEqual({kind: 'offered'});
  });

  it('checks again when the page becomes visible', async () => {
    const t = build();
    await t.update.attach(t.registration);
    t.becomeVisible();
    await settle();
    expect(t.registration.updates).toBe(2);
  });

  it('checks every hour while open', async () => {
    const t = build();
    await t.update.attach(t.registration);
    expect(t.tick().ms).toBe(HOURLY_MS);
    t.tick().run();
    await settle();
    expect(t.registration.updates).toBe(2);
  });

  it('is quiet when update() fails, and still looks at a waiting worker', async () => {
    const t = build(true);
    t.registration.updateFails = true;
    t.registration.waiting = new FakeWaiting();
    await expect(t.update.attach(t.registration)).resolves.toBeUndefined();
    expect(t.update.state.value).toEqual({kind: 'offered'});
  });

  it('reacts when an installing worker reaches installed', async () => {
    const t = build();
    await t.update.attach(t.registration);
    const installing = new FakeInstalling();
    const w = new FakeWaiting();
    t.registration.installing = installing;
    t.registration.updateFound();
    t.registration.installing = null;
    t.registration.waiting = w;
    installing.become('installed');
    expect(w.posted).toEqual([{type: 'SKIP_WAITING'}]);
  });

  it('forceRefresh unregisters, deletes only this scope\'s caches and reloads', async () => {
    const t = build(false, [
      `workbox-precache-v2-${SCOPE}`, `openisd-runtime-${SCOPE}`,
      'workbox-precache-v2-https://x.test/', 'openisd-catalogue',
    ]);
    await t.update.attach(t.registration);
    await t.update.forceRefresh();
    expect(t.registration.updates).toBe(2);
    expect(t.registration.unregistered).toBe(1);
    expect(t.caches.deleted).toEqual([`workbox-precache-v2-${SCOPE}`, `openisd-runtime-${SCOPE}`]);
    expect(t.reload).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh still reloads when update() fails', async () => {
    const t = build();
    await t.update.attach(t.registration);
    t.registration.updateFails = true;
    await t.update.forceRefresh();
    expect(t.registration.unregistered).toBe(1);
    expect(t.reload).toHaveBeenCalledTimes(1);
  });
});
