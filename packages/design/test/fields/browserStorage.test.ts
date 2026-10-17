import {describe, expect, it} from 'vitest';
import {
  LOCAL_STORE_LIMIT_BYTES,
  persistenceBanner,
  persistenceLine,
  persistenceWarning,
  savedNotice,
  siteStorageLine,
  startupNotice,
  storageFullWarning,
  storageUseLine,
} from '../../fields/browserStorage.js';

const mb = 1024 * 1024;
const twelve = {projectCount: 12, localBytes: 1.4 * mb};
const WARNING = 'Nothing is wrong now (12 projects, 1.4 MB of 5 MB used): this browser could clear OpenISD\'s data only if your disk gets nearly full. OpenISD warns you when its storage is 80% full (usage is in Options, Your data); to be safe, use Chrome, turn on Google Drive sync, or export your projects.';

describe('persistent storage', () => {
  it('names what the browser answered, for Diagnostics', () => {
    expect(persistenceLine('granted')).toBe('Persistent storage: granted');
    expect(persistenceLine('refused')).toBe('Persistent storage: refused');
    expect(persistenceLine('unsupported')).toBe('Persistent storage: unsupported');
    expect(persistenceLine(null)).toBe('Persistent storage: asking');
  });

  it('warns when the browser may clear the data, and the banner until dismissed', () => {
    expect(persistenceWarning('refused', twelve)).toBe(WARNING);
    expect(persistenceWarning('unsupported', twelve)).toBe(WARNING);
    expect(persistenceWarning('granted', twelve)).toBeNull();
    expect(persistenceWarning(null, twelve)).toBeNull();
    expect(persistenceBanner('refused', false, twelve)).toBe(WARNING);
    expect(persistenceBanner('refused', true, twelve)).toBeNull();
    expect(persistenceBanner('granted', false, twelve)).toBeNull();
  });
});

describe('storage use', () => {
  it('says how many projects and how much of the local store they use', () => {
    expect(storageUseLine(twelve)).toBe('12 projects, 1.4 MB of 5 MB used');
    expect(storageUseLine({projectCount: 1, localBytes: 20 * 1024})).toBe('1 project, 20.0 KB of 5 MB used');
  });

  it('says what the site uses of what the browser allows, when it can say', () => {
    expect(siteStorageLine({usage: 1_258_291, quota: 2_469_606_195})).toBe('This site uses 1.2 MB of the 2.3 GB this browser allows.');
    expect(siteStorageLine(null)).toBeNull();
    expect(siteStorageLine({usage: 0, quota: 0})).toBeNull();
  });

  it('warns from 80% of the local store or of the site allowance, whichever is fuller', () => {
    const gb = {usage: 10, quota: 1e9};
    const use = (share: number) => ({projectCount: 40, localBytes: LOCAL_STORE_LIMIT_BYTES * share});
    expect(storageFullWarning(use(0.79), gb)).toBeNull();
    expect(storageFullWarning(use(0.8), gb)).toBe('Storage is 80% full (40 projects, 4.0 MB of 5 MB used). Export or delete old projects.');
    expect(storageFullWarning(use(0.86), null)).toBe('Storage is 86% full (40 projects, 4.3 MB of 5 MB used). Export or delete old projects.');
    expect(storageFullWarning(use(0), {usage: 95, quota: 100})).toBe('Storage is 95% full (40 projects, 0 B of 5 MB used). Export or delete old projects.');
    expect(storageFullWarning(use(1.2), null)).toBe('Storage is 100% full (40 projects, 6.0 MB of 5 MB used). Export or delete old projects.');
  });
});

describe('the startup notice', () => {
  it('says how many projects and how much storage, when there are projects', () => {
    expect(startupNotice(twelve)).toBe('12 projects, 1.4 MB of 5 MB used.');
    expect(startupNotice({projectCount: 0, localBytes: 300})).toBeNull();
  });
});

describe('the save flash', () => {
  it('says what was saved, then how many projects and how much storage', () => {
    expect(savedNotice(2, twelve)).toBe('Saved 2 projects. 12 projects, 1.4 MB of 5 MB used.');
    expect(savedNotice(1, {projectCount: 1, localBytes: 20 * 1024})).toBe('Saved 1 project. 1 project, 20.0 KB of 5 MB used.');
  });

  it('says nothing was saved when nothing was', () => {
    expect(savedNotice(0, twelve)).toBe('Nothing to save');
  });

  it('warns instead of the usage line once storage is nearly full', () => {
    expect(savedNotice(1, {projectCount: 40, localBytes: 0.86 * LOCAL_STORE_LIMIT_BYTES}))
      .toBe('Saved 1 project. Storage is 86% full (40 projects, 4.3 MB of 5 MB used). Export or delete old projects.');
  });
});
