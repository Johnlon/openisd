import {describe, expect, it, vi} from 'vitest';
import {ReleaseWatch, type ReleasePort} from '../../src/logic/releaseWatch.js';
import {createBrowserReleasePort} from '../../src/logic/browserReleasePort.js';

function port(latest: string | null): ReleasePort & { reloadOntoLatest: ReturnType<typeof vi.fn<() => Promise<void>>> } {
  return { latestVersion: () => Promise.resolve(latest), reloadOntoLatest: vi.fn<() => Promise<void>>(() => Promise.resolve()) };
}

describe('ReleaseWatch', () => {
  it('stays quiet while the published build is the running one', async () => {
    const watch = new ReleaseWatch('v1', port('v1'));
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(false);
  });

  it('flags a different published build', async () => {
    const watch = new ReleaseWatch('v1', port('v2'));
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(true);
  });

  it('stays quiet when the published build cannot be read (offline)', async () => {
    const watch = new ReleaseWatch('v1', port(null));
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(false);
  });

  it('stays quiet when this build carries no version to compare (dev server)', async () => {
    const watch = new ReleaseWatch('', port('v2'));
    await watch.check();
    expect(watch.newVersionAvailable.value).toBe(false);
  });

  it('reload hands over to the port', async () => {
    const p = port('v2');
    await new ReleaseWatch('v1', p).reload();
    expect(p.reloadOntoLatest).toHaveBeenCalledOnce();
  });

  it('reload clears the notice once the port has reloaded, and keeps it when the reload fails', async () => {
    const ok = new ReleaseWatch('v1', port('v2'));
    await ok.check();
    await ok.reload();
    expect(ok.newVersionAvailable.value).toBe(false);

    const failing = port('v2');
    failing.reloadOntoLatest.mockRejectedValueOnce(new Error('offline'));
    const bad = new ReleaseWatch('v1', failing);
    await bad.check();
    await expect(bad.reload()).rejects.toThrow('offline');
    expect(bad.newVersionAvailable.value).toBe(true);
  });
});

describe('createBrowserReleasePort.latestVersion', () => {
  const noReload = { reload: () => undefined };
  const noWorker = undefined;

  it('reads the version out of build-info.json, bypassing the cache', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ version: 'v9' }))));
    const p = createBrowserReleasePort({ baseUrl: '/', fetch: fetchFn, serviceWorker: noWorker, location: noReload });
    expect(await p.latestVersion()).toBe('v9');
    expect(fetchFn).toHaveBeenCalledWith('/build-info.json', { cache: 'no-store' });
  });

  it('is null when the fetch fails, the status is bad, or the body is not a version', async () => {
    const make = (f: typeof fetch) => createBrowserReleasePort({ baseUrl: '/', fetch: f, serviceWorker: noWorker, location: noReload });
    expect(await make(() => Promise.reject(new Error('offline'))).latestVersion()).toBeNull();
    expect(await make(() => Promise.resolve(new Response('', { status: 404 }))).latestVersion()).toBeNull();
    expect(await make(() => Promise.resolve(new Response('{"nope":1}'))).latestVersion()).toBeNull();
  });
});
