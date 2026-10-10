import {describe, expect, it, vi} from 'vitest';
import {ReleaseWatch, type ReleasePort, type Logger} from '../../src/logic/releaseWatch.js';
import {createBrowserReleasePort} from '../../src/logic/browserReleasePort.js';

function createFakeLogger(): Logger & { logs: string[] } {
  const logs: string[] = [];
  return { log: (msg: string) => { logs.push(msg); }, logs };
}

function createFakeSessionStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
  };
}

function createFakePort(overrides: Partial<ReleasePort> = {}): ReleasePort {
  const recordedVersion: { current: string | null } = { current: null };
  const dismissedVersion: { current: string | null } = { current: null };
  return {
    latestVersion: () => Promise.resolve(null),
    reloadOntoLatest: () => Promise.resolve(),
    getRecordedReloadedVersion: () => recordedVersion.current,
    recordReloadedVersion: (v: string) => { recordedVersion.current = v; },
    getDismissedVersion: () => dismissedVersion.current,
    recordDismissedVersion: (v: string) => { dismissedVersion.current = v; },
    ...overrides,
  };
}

describe('ReleaseWatch', () => {
  it('stays quiet while the published build is the running one', async () => {
    const logger = createFakeLogger();
    const port = createFakePort({ latestVersion: () => Promise.resolve('v1') });
    const watch = new ReleaseWatch('v1', port, logger);
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(false);
  });

  it('flags a different published build', async () => {
    const logger = createFakeLogger();
    const port = createFakePort({ latestVersion: () => Promise.resolve('v2') });
    const watch = new ReleaseWatch('v1', port, logger);
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(true);
  });

  it('stays quiet when the published build cannot be read (offline)', async () => {
    const logger = createFakeLogger();
    const port = createFakePort({ latestVersion: () => Promise.resolve(null) });
    const watch = new ReleaseWatch('v1', port, logger);
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(false);
  });

  it('stays quiet when this build carries no version to compare (dev server)', async () => {
    const logger = createFakeLogger();
    const port = createFakePort({ latestVersion: () => Promise.resolve('v2') });
    const watch = new ReleaseWatch('', port, logger);
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(false);
  });

  it('reload hands over to the port', async () => {
    const logger = createFakeLogger();
    const reloadFn = vi.fn<() => Promise<void>>(() => Promise.resolve());
    const port = createFakePort({ latestVersion: () => Promise.resolve('v2'), reloadOntoLatest: reloadFn });
    await new ReleaseWatch('v1', port, logger).reload();
    expect(reloadFn).toHaveBeenCalledOnce();
  });

  it('reload clears the notice once the port has reloaded, and keeps it when the reload fails', async () => {
    const logger = createFakeLogger();
    const okPort = createFakePort({ latestVersion: () => Promise.resolve('v2'), reloadOntoLatest: () => Promise.resolve() });
    const ok = new ReleaseWatch('v1', okPort, logger);
    await ok.check();
    await ok.reload();
    expect(ok.newVersionAvailable.value).toBe(false);

    const failingPort = createFakePort({
      latestVersion: () => Promise.resolve('v2'),
      reloadOntoLatest: vi.fn<() => Promise<void>>(() => Promise.reject(new Error('offline'))),
    });
    const bad = new ReleaseWatch('v1', failingPort, logger);
    await bad.check();
    await expect(bad.reload()).rejects.toThrow('offline');
    expect(bad.newVersionAvailable.value).toBe(true);
  });

  it('after reload with same mismatch, notice stays hidden (no loop)', async () => {
    const logger = createFakeLogger();
    const port = createFakePort({ latestVersion: () => Promise.resolve('v2') });
    const watch = new ReleaseWatch('v1', port, logger);
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(true);
    await watch.reload();
    expect(watch.newVersionAvailable.value).toBe(false);
    // After reload, check again with same published version
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(false);
    expect(logger.logs).toContain('[release] bundle still differs from published version v2 (already reloaded)');
  });

  it('a different newer version shows the notice again', async () => {
    const logger = createFakeLogger();
    const port = createFakePort({ latestVersion: () => Promise.resolve('v2') });
    const watch = new ReleaseWatch('v1', port, logger);
    await watch.check();
    await watch.reload();
    // Now a newer version v3 is published
    port.latestVersion = () => Promise.resolve('v3');
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(true);
  });

  it('dismisses the notice for the current published version', async () => {
    const logger = createFakeLogger();
    const port = createFakePort({ latestVersion: () => Promise.resolve('v2') });
    const watch = new ReleaseWatch('v1', port, logger);
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(true);
    await watch.dismiss();
    expect(watch.newVersionAvailable.value).toBe(false);
    expect(port.getDismissedVersion()).toBe('v2');
  });

  it('after dismiss, same version stays hidden (persists across reload)', async () => {
    const logger = createFakeLogger();
    const dismissedVersion: { current: string | null } = { current: null };
    const port = createFakePort({
      latestVersion: () => Promise.resolve('v2'),
      getDismissedVersion: () => dismissedVersion.current,
      recordDismissedVersion: (v: string) => { dismissedVersion.current = v; },
    });
    const watch = new ReleaseWatch('v1', port, logger);
    await watch.check();
    await watch.dismiss();
    expect(watch.newVersionAvailable.value).toBe(false);
    // Simulate a fresh ReleaseWatch over the same storage (page reload)
    const watch2 = new ReleaseWatch('v1', port, logger);
    await watch2.check();
    expect(watch2.newVersionAvailable.value).toBe(false);
    expect(logger.logs).toContain('[release] published version v2 was dismissed');
  });

  it('a newer version shows the notice again after dismiss', async () => {
    const logger = createFakeLogger();
    const dismissedVersion: { current: string | null } = { current: null };
    const port = createFakePort({
      latestVersion: () => Promise.resolve('v2'),
      getDismissedVersion: () => dismissedVersion.current,
      recordDismissedVersion: (v: string) => { dismissedVersion.current = v; },
    });
    const watch = new ReleaseWatch('v1', port, logger);
    await watch.check();
    await watch.dismiss();
    expect(watch.newVersionAvailable.value).toBe(false);
    // Now a newer version v3 is published
    port.latestVersion = () => Promise.resolve('v3');
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(true);
  });
});

describe('createBrowserReleasePort.latestVersion', () => {
  const noReload = { reload: () => undefined };
  const noWorker = undefined;
  const sessionStorage = createFakeSessionStorage();

  it('reads the version out of build-info.json, bypassing the cache', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ version: 'v9' }))));
    const p = createBrowserReleasePort({ baseUrl: '/', fetch: fetchFn, serviceWorker: noWorker, location: noReload, sessionStorage });
    expect(await p.latestVersion()).toBe('v9');
    expect(fetchFn).toHaveBeenCalledWith('/build-info.json', { cache: 'no-store' });
  });

  it('calls fetch the way a browser requires: not as a method of another object', async () => {
    // The browser's fetch throws "Illegal invocation" when `this` is anything but the window.
    const browserLikeFetch: typeof fetch = function (this: unknown) {
      if (this !== undefined && this !== globalThis) return Promise.reject(new TypeError('Illegal invocation'));
      return Promise.resolve(new Response(JSON.stringify({ version: 'v9' })));
    };
    const p = createBrowserReleasePort({ baseUrl: '/', fetch: browserLikeFetch, serviceWorker: noWorker, location: noReload, sessionStorage });
    expect(await p.latestVersion()).toBe('v9');
  });

  it('is null when the fetch fails, the status is bad, or the body is not a version', async () => {
    const make = (f: typeof fetch) => createBrowserReleasePort({ baseUrl: '/', fetch: f, serviceWorker: noWorker, location: noReload, sessionStorage });
    expect(await make(() => Promise.reject(new Error('offline'))).latestVersion()).toBeNull();
    expect(await make(() => Promise.resolve(new Response('', { status: 404 }))).latestVersion()).toBeNull();
    expect(await make(() => Promise.resolve(new Response('{"nope":1}'))).latestVersion()).toBeNull();
  });
});

describe('createBrowserReleasePort dismissed version', () => {
  const noReload = { reload: () => undefined };
  const noWorker = undefined;

  it('getDismissedVersion returns null initially', async () => {
    const sessionStorage = createFakeSessionStorage();
    const p = createBrowserReleasePort({
      baseUrl: '/',
      fetch: () => Promise.resolve(new Response('{}')),
      serviceWorker: noWorker,
      location: noReload,
      sessionStorage,
    });
    expect(p.getDismissedVersion()).toBeNull();
  });

  it('recordDismissedVersion stores the version in sessionStorage', async () => {
    const sessionStorage = createFakeSessionStorage();
    const p = createBrowserReleasePort({
      baseUrl: '/',
      fetch: () => Promise.resolve(new Response('{}')),
      serviceWorker: noWorker,
      location: noReload,
      sessionStorage,
    });
    p.recordDismissedVersion('v2');
    expect(sessionStorage.setItem).toHaveBeenCalledWith('openisd-dismissed-version', 'v2');
    expect(p.getDismissedVersion()).toBe('v2');
  });

  it('getDismissedVersion returns stored version after reload', async () => {
    const sessionStorage = createFakeSessionStorage();
    sessionStorage.getItem.mockReturnValueOnce('v2');
    const p = createBrowserReleasePort({
      baseUrl: '/',
      fetch: () => Promise.resolve(new Response('{}')),
      serviceWorker: noWorker,
      location: noReload,
      sessionStorage,
    });
    expect(p.getDismissedVersion()).toBe('v2');
  });

  it('handles sessionStorage that throws (private browsing, quota exceeded)', async () => {
    const throwingStorage = {
      getItem: vi.fn(() => { throw new Error('SecurityError'); }),
      setItem: vi.fn(() => { throw new Error('QuotaExceededError'); }),
    };
    const p = createBrowserReleasePort({
      baseUrl: '/',
      fetch: () => Promise.resolve(new Response('{}')),
      serviceWorker: noWorker,
      location: noReload,
      sessionStorage: throwingStorage,
    });
    expect(p.getDismissedVersion()).toBeNull();
    expect(() => p.recordDismissedVersion('v2')).not.toThrow();
    expect(p.getDismissedVersion()).toBeNull();
  });
});