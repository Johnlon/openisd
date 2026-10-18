import {describe, expect, it} from 'vitest';
import {
  LOCAL_STORE_LIMIT_BYTES,
  browserNameOf,
  persistenceLine,
  persistenceWarning,
  savedNotice,
  siteStorageLine,
  startupNotice,
  acknowledgementInPlaceOfBannerMark,
  storagePopup,
  storagePopupAfterSave,
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

  it('warns when the browser may clear the data', () => {
    expect(persistenceWarning('refused', twelve)).toBe(WARNING);
    expect(persistenceWarning('unsupported', twelve)).toBe(WARNING);
    expect(persistenceWarning('granted', twelve)).toBeNull();
    expect(persistenceWarning(null, twelve)).toBeNull();
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


describe('the browser, from its user agent', () => {
  it('names the browser that sent it', () => {
    expect(browserNameOf('Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0')).toBe('Firefox');
    expect(browserNameOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/130.0 Mobile/15E148 Safari/605.1.15')).toBe('Firefox');
    expect(browserNameOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')).toBe('Chrome');
    expect(browserNameOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0')).toBe('Edge');
    expect(browserNameOf('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0')).toBe('Opera');
    expect(browserNameOf('Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36')).toBe('Samsung Internet');
    expect(browserNameOf('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe('Safari');
    expect(browserNameOf('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1')).toBe('Chrome');
    expect(browserNameOf('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/120.0.0.0 Safari/537.36')).toBe('Chrome');
    expect(browserNameOf('curl/8.0')).toBe('This browser');
  });
});

describe('the storage popup', () => {
  const quiet = {outcome: 'granted' as const, browser: 'Chrome' as const, use: twelve, estimate: null, acknowledgedRisk: null};
  const full = {projectCount: 40, localBytes: 0.86 * LOCAL_STORE_LIMIT_BYTES};

  it('says nothing when the browser keeps the data and storage is not near full', () => {
    expect(storagePopup(quiet)).toEqual({kind: 'none'});
    expect(storagePopup({...quiet, outcome: null})).toEqual({kind: 'none'});
  });

  it('names the browser as the reason when it refused or cannot promise, and suggests Drive sync first, then export', () => {
    const popup = storagePopup({...quiet, outcome: 'refused', browser: 'Firefox'});
    expect(popup).toEqual({
      kind: 'risk',
      condition: 'refused:Firefox',
      title: 'Your projects may not be kept',
      message: "Firefox has not promised to keep this site's data, so it could clear your OpenISD projects if your disk gets nearly full. Best: turn on Google Drive sync, so your projects live in Drive. Otherwise export your projects.",
    });
    expect(storagePopup({...quiet, outcome: 'unsupported', browser: 'Safari'})).toMatchObject({kind: 'risk', condition: 'unsupported:Safari'});
  });

  it('stays quiet once this condition was closed, and shows again when the condition changes', () => {
    expect(storagePopup({...quiet, outcome: 'refused', browser: 'Firefox', acknowledgedRisk: 'refused:Firefox'})).toEqual({kind: 'none'});
    expect(storagePopup({...quiet, outcome: 'refused', browser: 'Firefox', acknowledgedRisk: 'refused:Chrome'})).toMatchObject({kind: 'risk'});
    expect(storagePopup({...quiet, outcome: 'unsupported', browser: 'Firefox', acknowledgedRisk: 'refused:Firefox'})).toMatchObject({kind: 'risk'});
  });

  it('counts a banner dismissed before the popup existed as seen', () => {
    expect(storagePopup({...quiet, outcome: 'refused', browser: 'Firefox', acknowledgedRisk: '1'})).toEqual({kind: 'none'});
  });

  it('replaces the closed-banner mark with the condition seen now, so a later change shows the popup (John, QO251)', () => {
    expect(acknowledgementInPlaceOfBannerMark({...quiet, outcome: 'refused', browser: 'Firefox', acknowledgedRisk: '1'})).toBe('refused:Firefox');
    expect(acknowledgementInPlaceOfBannerMark({...quiet, outcome: 'granted', browser: 'Chrome', acknowledgedRisk: '1'})).toBe('granted:Chrome');
    expect(storagePopup({...quiet, outcome: 'refused', browser: 'Chrome', acknowledgedRisk: 'granted:Chrome'})).toMatchObject({kind: 'risk'});
    expect(acknowledgementInPlaceOfBannerMark({...quiet, outcome: 'refused', browser: 'Firefox', acknowledgedRisk: 'refused:Firefox'})).toBeNull();
    expect(acknowledgementInPlaceOfBannerMark({...quiet, outcome: 'refused', browser: 'Firefox', acknowledgedRisk: null})).toBeNull();
  });

  it('says how full storage is from 80%, and suggests Drive sync, else export or delete', () => {
    expect(storagePopup({...quiet, use: full})).toEqual({
      kind: 'nearlyFull',
      title: 'Storage is nearly full',
      message: 'Storage is 86% full (40 projects, 4.3 MB of 5 MB used). Best: turn on Google Drive sync, so your projects live in Drive. Otherwise export your projects or delete old ones.',
    });
    expect(storagePopup({...quiet, use: {projectCount: 40, localBytes: 0.79 * LOCAL_STORE_LIMIT_BYTES}})).toEqual({kind: 'none'});
    expect(storagePopup({...quiet, estimate: {usage: 95, quota: 100}}).kind).toBe('nearlyFull');
  });

  it('shows nearly full at every start, even when the risk was closed, and then also names the browser', () => {
    const popup = storagePopup({...quiet, use: full, outcome: 'refused', browser: 'Firefox', acknowledgedRisk: 'refused:Firefox'});
    expect(popup).toMatchObject({kind: 'nearlyFull'});
    expect(popup.kind === 'nearlyFull' ? popup.message : '').toContain("Firefox has not promised to keep this site's data.");
  });
});

describe('the storage popup after a save', () => {
  const below = {use: {projectCount: 5, localBytes: 0.79 * LOCAL_STORE_LIMIT_BYTES}, estimate: null};
  const above = {use: {projectCount: 6, localBytes: 0.81 * LOCAL_STORE_LIMIT_BYTES}, estimate: null};
  const rest = {outcome: 'granted' as const, browser: 'Chrome' as const, acknowledgedRisk: null};

  it('shows nearly full when the save took storage from below 80% to 80% or more', () => {
    const popup = storagePopupAfterSave(below, {...above, ...rest});
    expect(popup).toMatchObject({kind: 'nearlyFull', title: 'Storage is nearly full'});
    expect(popup.kind === 'nearlyFull' ? popup.message : '').toContain('Storage is 81% full (6 projects');
  });

  it('shows it when the site allowance is what crossed', () => {
    const popup = storagePopupAfterSave(below, {use: below.use, estimate: {usage: 80, quota: 100}, ...rest});
    expect(popup.kind).toBe('nearlyFull');
  });

  it('says nothing when storage was already at 80% or more, or is still below', () => {
    expect(storagePopupAfterSave(above, {...above, ...rest})).toEqual({kind: 'none'});
    expect(storagePopupAfterSave(below, {...below, ...rest})).toEqual({kind: 'none'});
    expect(storagePopupAfterSave(above, {...below, ...rest})).toEqual({kind: 'none'});
  });
});
