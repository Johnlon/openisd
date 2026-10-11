import {describe, expect, it, vi} from 'vitest';
import type {DevVersionPort, HotUpdateSource, DevAppVersion} from '../../src/logic/appVersion.js';
import {parseDevVersion, createPublishedVersion, createDevVersionPort, createAppVersionPort} from '../../src/logic/appVersion.js';
import type {ToLocalTime} from '@openisd/design/fields';

const testLocalTime: ToLocalTime = (epochMs: number) => {
  const d = new Date(epochMs);
  return {
    monthIndex: d.getMonth(),
    day: d.getDate(),
    hour: d.getHours(),
    minute: d.getMinutes(),
  };
};

function createFakeHotUpdateSource(): {
  source: HotUpdateSource;
  fire: () => Promise<void>;
} {
  const listeners: (() => void)[] = [];
  return {
    source: {
      onUpdate: (listener) => { listeners.push(listener); },
    },
    fire: async () => {
      for (const l of listeners) l();
    },
  };
}

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
      fetchDevVersion: () => Promise.resolve({ kind: 'dev', sha: '5a3f9c1', hasChanges: false }),
    });
    const dev = await port.fetchDevVersion();
    expect(dev).toEqual({ kind: 'dev', sha: '5a3f9c1', hasChanges: false });
  });

  it('fetchDevVersion returns null on failure', async () => {
    const port = createFakeDevPort({
      fetchDevVersion: () => Promise.resolve(null),
    });
    const raw = await port.fetchDevVersion();
    expect(raw).toBeNull();
  });

  it('fetchDevVersion handles network error', async () => {
    const port = createFakeDevPort({
      fetchDevVersion: () => Promise.reject(new Error('offline')),
    });
    await expect(port.fetchDevVersion()).rejects.toThrow('offline');
  });
});

describe('createDevVersionPort', () => {
  it('fetches dev version from baseUrl and parses at boundary', async () => {
    const fetchFn = vi.fn<typeof fetch>(() => Promise.resolve(new Response(JSON.stringify({ sha: 'abc123', hasChanges: true }))));
    const port = createDevVersionPort('/base/', fetchFn);
    const result = await port.fetchDevVersion();
    expect(result).toEqual({ kind: 'dev', sha: 'abc123', hasChanges: true });
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
      fetchDevVersion: () => Promise.resolve({ kind: 'dev', sha: '5a3f9c1', hasChanges: false }),
    };
    const port = createAppVersionPort(true, '', devPort, testLocalTime);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'dev', sha: '5a3f9c1', hasChanges: false });
  });

  it('returns unknown in dev mode when devPort is null', async () => {
    const port = createAppVersionPort(true, '', null, testLocalTime);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'unknown' });
  });

  it('returns unknown in dev mode when fetch fails', async () => {
    const devPort: DevVersionPort = {
      fetchDevVersion: () => Promise.resolve(null),
    };
    const port = createAppVersionPort(true, '', devPort, testLocalTime);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'unknown' });
  });

  it('returns published version in production mode', async () => {
    const port = createAppVersionPort(false, 'v20261010T123456Z', null, testLocalTime);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'published', version: 'v20261010T123456Z' });
  });

  it('returns unknown in production mode when baked version is empty', async () => {
    const port = createAppVersionPort(false, '', null, testLocalTime);
    const version = await port.getVersion();
    expect(version).toEqual({ kind: 'unknown' });
  });

  it('returns formatted label in dev mode', async () => {
    const devPort: DevVersionPort = {
      fetchDevVersion: () => Promise.resolve({ kind: 'dev', sha: '5a3f9c1', hasChanges: true }),
    };
    const port = createAppVersionPort(true, '', devPort, testLocalTime);
    expect(await port.getVersionLabel()).toBe('dev 5a3f9c1 + changes');
  });

  it('returns formatted label in production mode using supplied toLocalTime', async () => {
    const fakeUtcZero: ToLocalTime = (epochMs: number) => {
      const d = new Date(epochMs);
      return {
        monthIndex: d.getUTCMonth(),
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
      };
    };
    const port = createAppVersionPort(false, 'v20261009T234100Z', null, fakeUtcZero);
    expect(await port.getVersionLabel()).toBe('Oct 09 23:41');
  });

  it('returns unparseable version verbatim in getVersionLabel', async () => {
    const port = createAppVersionPort(false, 'custom-version', null, testLocalTime);
    expect(await port.getVersionLabel()).toBe('custom-version');
  });

  it('updates reactive label on hot update in dev mode', async () => {
    const hotSource = createFakeHotUpdateSource();
    let currentDev = { kind: 'dev' as const, sha: 'aaa', hasChanges: false };
    const devPort: DevVersionPort = {
      fetchDevVersion: vi.fn(() => Promise.resolve(currentDev)),
    };
    const port = createAppVersionPort(true, '', devPort, testLocalTime, hotSource.source);

    // Initial fetch produces "dev aaa"
    await port.getVersionLabel();
    expect(port.label.value).toBe('dev aaa');

    // Change dev version to sha "bbb" and fire hot update
    currentDev = { kind: 'dev', sha: 'bbb', hasChanges: false };
    await hotSource.fire();
    expect(port.label.value).toBe('dev bbb');

    // Flip hasChanges to true and fire hot update
    currentDev = { kind: 'dev', sha: 'bbb', hasChanges: true };
    await hotSource.fire();
    expect(port.label.value).toBe('dev bbb + changes');
  });

  it('never refetches in a published build even if hot update fires', async () => {
    const hotSource = createFakeHotUpdateSource();
    const devPort: DevVersionPort = {
      fetchDevVersion: vi.fn((): Promise<DevAppVersion | null> => Promise.resolve({ kind: 'dev', sha: 'ccc', hasChanges: false })),
    };
    const port = createAppVersionPort(false, 'v20261009T234100Z', devPort, testLocalTime, hotSource.source);
    expect(port.label.value).toBe(await port.getVersionLabel());
    expect(devPort.fetchDevVersion).not.toHaveBeenCalled();

    await hotSource.fire();
    expect(devPort.fetchDevVersion).not.toHaveBeenCalled();
  });

  it('keeps previous label on fetch failure during refresh rather than flashing unknown', async () => {
    const hotSource = createFakeHotUpdateSource();
    let result: DevAppVersion | null = { kind: 'dev', sha: 'bbb', hasChanges: true };
    const devPort: DevVersionPort = {
      fetchDevVersion: vi.fn((): Promise<DevAppVersion | null> => Promise.resolve(result)),
    };
    const port = createAppVersionPort(true, '', devPort, testLocalTime, hotSource.source);

    await port.getVersionLabel();
    expect(port.label.value).toBe('dev bbb + changes');

    // Simulate transient failure during refresh
    result = null;
    await hotSource.fire();
    expect(port.label.value).toBe('dev bbb + changes');
  });
});