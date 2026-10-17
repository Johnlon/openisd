import {describe, expect, it, vi} from 'vitest';
import {createBrowserStoragePort, createPersistenceStatus, createUsageNoticeTab, type BrowserStoragePort} from '../src/storage/browserStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';

describe('createBrowserStoragePort', () => {
  it('is granted at once when the browser already keeps the data, without asking again', async () => {
    const persist = vi.fn(() => Promise.resolve(false));
    expect(await createBrowserStoragePort({persisted: () => Promise.resolve(true), persist}).persist()).toBe('granted');
    expect(persist).not.toHaveBeenCalled();
  });

  it('asks, and says granted or refused as the browser answers', async () => {
    expect(await createBrowserStoragePort({persisted: () => Promise.resolve(false), persist: () => Promise.resolve(true)}).persist()).toBe('granted');
    expect(await createBrowserStoragePort({persist: () => Promise.resolve(false)}).persist()).toBe('refused');
  });

  it('is unsupported when the browser has no storage manager or it throws', async () => {
    expect(await createBrowserStoragePort(undefined).persist()).toBe('unsupported');
    expect(await createBrowserStoragePort({}).persist()).toBe('unsupported');
    expect(await createBrowserStoragePort({persist: () => Promise.reject(new Error('no'))}).persist()).toBe('unsupported');
  });

  it('gives the estimate only when the browser says both numbers', async () => {
    expect(await createBrowserStoragePort({estimate: () => Promise.resolve({usage: 10, quota: 100})}).estimate()).toEqual({usage: 10, quota: 100});
    expect(await createBrowserStoragePort({estimate: () => Promise.resolve({usage: 10})}).estimate()).toBeNull();
    expect(await createBrowserStoragePort(undefined).estimate()).toBeNull();
    expect(await createBrowserStoragePort({estimate: () => Promise.reject(new Error('no'))}).estimate()).toBeNull();
  });
});

describe('createPersistenceStatus', () => {
  function fakePort(answer: 'granted' | 'refused'): BrowserStoragePort & {asked: number} {
    const port = {
      asked: 0,
      persist() { port.asked++; return Promise.resolve(answer); },
      estimate: () => Promise.resolve(null),
    };
    return port;
  }

  it('asks the browser once, keeps the answer and tells the watchers', async () => {
    const port = fakePort('refused');
    const status = createPersistenceStatus(port, createMemoryStorage({}));
    const changed = vi.fn();
    status.watch(changed);
    expect(status.outcome()).toBeNull();
    await Promise.all([status.ask(), status.ask()]);
    expect(port.asked).toBe(1);
    expect(status.outcome()).toBe('refused');
    expect(changed).toHaveBeenCalledTimes(1);
  });

  it('remembers a dismissed banner in this browser', () => {
    const storage = createMemoryStorage({});
    const status = createPersistenceStatus(fakePort('refused'), storage);
    expect(status.bannerDismissed()).toBe(false);
    status.dismissBanner();
    expect(createPersistenceStatus(fakePort('refused'), storage).bannerDismissed()).toBe(true);
  });
});

describe('createUsageNoticeTab', () => {
  it('is due once per tab: not again once shown, even in a new start of the same tab', () => {
    const tabStorage = createMemoryStorage({});
    const tab = createUsageNoticeTab(tabStorage);
    expect(tab.due()).toBe(true);
    tab.shown();
    expect(tab.due()).toBe(false);
    expect(createUsageNoticeTab(tabStorage).due()).toBe(false);
    expect(createUsageNoticeTab(createMemoryStorage({})).due()).toBe(true);
  });
});
