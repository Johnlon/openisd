import {describe, expect, it, vi} from 'vitest';
import {createBrowserReleasePort} from '../../src/logic/browserReleasePort.js';

const noReload = { reload: () => undefined };
const noWorker = undefined;

function createFakeSessionStorage() {
  const store = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { store.set(key, value); }),
    removeItem: vi.fn((key: string) => { store.delete(key); }),
    clear: vi.fn(() => { store.clear(); }),
  };
}

describe('createBrowserReleasePort sessionStorage', () => {
  it('getRecordedReloadedVersion returns null initially', async () => {
    const sessionStorage = createFakeSessionStorage();
    const p = createBrowserReleasePort({
      baseUrl: '/',
      fetch: () => Promise.resolve(new Response('{}')),
      serviceWorker: noWorker,
      location: noReload,
      sessionStorage,
    });
    expect(p.getRecordedReloadedVersion()).toBeNull();
  });

  it('recordReloadedVersion stores the version in sessionStorage', async () => {
    const sessionStorage = createFakeSessionStorage();
    const p = createBrowserReleasePort({
      baseUrl: '/',
      fetch: () => Promise.resolve(new Response('{}')),
      serviceWorker: noWorker,
      location: noReload,
      sessionStorage,
    });
    p.recordReloadedVersion('v2');
    expect(sessionStorage.setItem).toHaveBeenCalledWith('openisd-reloaded-version', 'v2');
    expect(p.getRecordedReloadedVersion()).toBe('v2');
  });

  it('getRecordedReloadedVersion returns stored version after reload', async () => {
    const sessionStorage = createFakeSessionStorage();
    sessionStorage.getItem.mockReturnValueOnce('v2');
    const p = createBrowserReleasePort({
      baseUrl: '/',
      fetch: () => Promise.resolve(new Response('{}')),
      serviceWorker: noWorker,
      location: noReload,
      sessionStorage,
    });
    expect(p.getRecordedReloadedVersion()).toBe('v2');
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
    expect(p.getRecordedReloadedVersion()).toBeNull();
    expect(() => p.recordReloadedVersion('v2')).not.toThrow();
    expect(p.getRecordedReloadedVersion()).toBeNull();
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