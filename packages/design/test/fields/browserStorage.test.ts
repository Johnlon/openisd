import {describe, expect, it} from 'vitest';
import {
  LOCAL_STORE_LIMIT_BYTES,
  persistenceBanner,
  persistenceLine,
  persistenceWarning,
  siteStorageLine,
  storageFullWarning,
} from '../../fields/browserStorage.js';

const WARNING = 'This browser may delete OpenISD\'s data when disk space runs low. Use Chrome, or turn on Google Drive sync and export your projects.';

describe('persistent storage', () => {
  it('names what the browser answered, for Diagnostics', () => {
    expect(persistenceLine('granted')).toBe('Persistent storage: granted');
    expect(persistenceLine('refused')).toBe('Persistent storage: refused');
    expect(persistenceLine('unsupported')).toBe('Persistent storage: unsupported');
    expect(persistenceLine(null)).toBe('Persistent storage: asking');
  });

  it('warns when the browser may clear the data, and the banner until dismissed', () => {
    expect(persistenceWarning('refused')).toBe(WARNING);
    expect(persistenceWarning('unsupported')).toBe(WARNING);
    expect(persistenceWarning('granted')).toBeNull();
    expect(persistenceWarning(null)).toBeNull();
    expect(persistenceBanner('refused', false)).toBe(WARNING);
    expect(persistenceBanner('refused', true)).toBeNull();
    expect(persistenceBanner('granted', false)).toBeNull();
  });
});

describe('storage use', () => {
  it('says what the site uses of what the browser allows, when it can say', () => {
    expect(siteStorageLine({usage: 1_258_291, quota: 2_469_606_195})).toBe('This site uses 1.2 MB of the 2.3 GB this browser allows.');
    expect(siteStorageLine(null)).toBeNull();
    expect(siteStorageLine({usage: 0, quota: 0})).toBeNull();
  });

  it('warns from 80% of the local store or of the site allowance, whichever is fuller', () => {
    const gb = {usage: 10, quota: 1e9};
    expect(storageFullWarning(LOCAL_STORE_LIMIT_BYTES * 0.79, gb)).toBeNull();
    expect(storageFullWarning(LOCAL_STORE_LIMIT_BYTES * 0.8, gb)).toBe('Storage is 80% full. Export or delete old projects.');
    expect(storageFullWarning(LOCAL_STORE_LIMIT_BYTES * 0.86, null)).toBe('Storage is 86% full. Export or delete old projects.');
    expect(storageFullWarning(0, {usage: 95, quota: 100})).toBe('Storage is 95% full. Export or delete old projects.');
    expect(storageFullWarning(LOCAL_STORE_LIMIT_BYTES * 1.2, null)).toBe('Storage is 100% full. Export or delete old projects.');
  });
});
