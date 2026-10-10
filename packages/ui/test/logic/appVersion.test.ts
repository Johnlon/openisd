import {describe, expect, it, vi} from 'vitest';
import type {DevVersionPort} from '../../src/logic/appVersion.js';
import {parseDevVersion, createPublishedVersion, createDevVersionPort, createAppVersionPort} from '../../src/logic/appVersion.js';

function createFakeDevPort(overrides: Partial<DevVersionPort> = {}): DevVersionPort {
  return {
    fetchDevVersion: () => Promise.resolve(null),
    ...overrides,
  };
}

describe('AppVersion sum type', () => {
  it('createPublishedVersion returns published for non-empty string', () => {
    const v = createPublishedVersion('v20261010T123456Z');
    expect(v).toEqual({ kind: 'published', version: 'v20261010T123456Z' });
  });

  it('createPublishedVersion returns unknown for empty string', () => {
    const v = createPublishedVersion('');
    expect(v).toEqual({ kind: 'unknown' });
  });

  it('parseDevVersion parses valid dev version', () => {
    const v = parseDevVersion({ sha: 'abc1234', hasChanges: true });
    expect(v).toEqual({ kind: 'dev', sha: 'abc1234', hasChanges: true });
  });

  it('parseDevVersion returns unknown for missing sha', () => {
    const v = parseDevVersion({ hasChanges: true });
    expect(v).toEqual({ kind: 'unknown' });
  });

  it('parseDevVersion returns unknown for missing hasChanges', () => {
    const v = parseDevVersion({ sha: 'abc1234' });
    expect(v).toEqual({ kind: 'unknown' });
  });

  it('parseDevVersion returns unknown for non-object', () => {
    const v = parseDevVersion('not an object');
    expect(v).toEqual({ kind: 'unknown' });
  });

  it('parseDevVersion returns unknown for null', () => {
    const v = parseDevVersion(null);
    expect(v).toEqual({ kind: 'unknown' });
  });

  it('parseDevVersion returns unknown for wrong types', () => {
    const v = parseDevVersion({ sha: 123, hasChanges: 'yes' });
    expect(v).toEqual({ kind: 'unknown' });
  });
});

describe('DevVersionPort', () => {
  it('fetchDevVersion returns parsed version on success', async () => {
    const port = createFakeDevPort({
      fetchDevVersion: () => Promise.resolve({ sha: '5a3f9c1', hasChanges: false }),
    });
    const raw = await port.fetchDevVersion();
    expect(raw).toEqual({ sha: '5a3f9c1', hasChanges: false });
    const parsed = parseDevVersion(raw);
    expect(parsed).toEqual({ kind: 'dev', sha: '5a3f9c1', hasChanges: false });
  });

  it('fetchDevVersion returns null on failure', async () => {
    const port = createFakeDevPort({
      fetchDevVersion: () => Promise.resolve(null),
    });
    const raw = await port.fetchDevVersion();
    expect(raw).toBeNull();
    const parsed = parseDevVersion(raw);
    expect(parsed).toEqual({ kind: 'unknown' });
  });

  it('fetchDevVersion handles network error', async () => {
    const port = createFakeDevPort({
      fetchDevVersion: () => Promise.reject(new Error('offline')),
    });
    await expect(port.fetchDevVersion()).rejects.toThrow('offline');
  });
});

describe('createDevVersionPort', () => {
  it('fetches dev version from baseUrl', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ sha: 'abc123', hasChanges: true }))));
    const port = createDevVersionPort('/base/', fetchFn);
    const result = await port.fetchDevVersion();
    expect(result).toEqual({ sha: 'abc123', hasChanges: true });
    expect(fetchFn).toHaveBeenCalledWith('/base/dev-version.json', { cache: 'no-store' });
  });

  it('returns null on non-ok response', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response('', { status: 404 })));
    const port = createDevVersionPort('/base/', fetchFn);
    const result = await port.fetchDevVersion();
    expect(result).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response('not json')));
    const port = createDevVersionPort('/base/', fetchFn);
    const result = await port.fetchDevVersion();
    expect(result).toBeNull();
  });

  it('returns null on network error', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.reject(new Error('offline')));
    const port = createDevVersionPort('/base/', fetchFn);
    const result = await port.fetchDevVersion();
    expect(result).toBeNull();
  });
});

describe('createAppVersionPort', () => {
  it('returns dev version in dev mode', async () => {
    const devPort: DevVersionPort = {
      fetchDevVersion: () => Promise.resolve({ sha: '5a3f9c1', hasChanges: false }),
    };
    const port = createAppVersionPort(true, '', devPort);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'dev', sha: '5a3f9c1', hasChanges: false });
  });

  it('returns unknown in dev mode when devPort is null', async () => {
    const port = createAppVersionPort(true, '', null);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'unknown' });
  });

  it('returns unknown in dev mode when fetch fails', async () => {
    const devPort: DevVersionPort = {
      fetchDevVersion: () => Promise.resolve(null),
    };
    const port = createAppVersionPort(true, '', devPort);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'unknown' });
  });

  it('returns published version in production mode', async () => {
    const port = createAppVersionPort(false, 'v20261010T123456Z', null);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'published', version: 'v20261010T123456Z' });
  });

  it('returns unknown in production mode when baked version is empty', async () => {
    const port = createAppVersionPort(false, '', null);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'unknown' });
  });
});