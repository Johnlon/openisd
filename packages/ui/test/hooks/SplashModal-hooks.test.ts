import {describe, expect, it} from 'vitest';
import {nextTick, reactive} from 'vue';

/** Let the watcher run and the catalogue's promises settle. */
const flush = async () => { await nextTick(); await Promise.resolve(); await Promise.resolve(); };
import {useSplashModal, type SplashState} from '../../src/hooks/SplashModal-hooks.js';

function state(seen?: boolean): SplashState {
  return reactive<SplashState>({ui: seen === undefined ? {} : {splashSeen: seen}});
}

describe('useSplashModal', () => {
  it('opens on a first visit — nothing has recorded that the splash was seen', () => {
    expect(useSplashModal(state()).open.value).toBe(true);
  });

  it('stays shut on a later visit', () => {
    expect(useSplashModal(state(true)).open.value).toBe(false);
  });

  it('dismissing records that it was seen, so the next visit is quiet', () => {
    const s = state();
    const api = useSplashModal(s);
    api.dismiss();
    expect(api.open.value).toBe(false);
    expect(s.ui.splashSeen).toBe(true);
    expect(useSplashModal(s).open.value).toBe(false);
  });

  it('show() reopens it after dismissal — the Info menu entry', () => {
    const s = state(true);
    const api = useSplashModal(s);
    api.show();
    expect(api.open.value).toBe(true);
  });
});

describe('useSplashModal — catalogue counts', () => {
  /** A catalogue whose answers are controlled, and which records that it was asked. */
  function catalogue(drivers: number, passiveRadiators: number) {
    const asked = {drivers: 0, passiveRadiators: 0};
    return {
      asked,
      api: {
        driverCount: async () => { asked.drivers++; return drivers; },
        passiveRadiatorCount: async () => { asked.passiveRadiators++; return passiveRadiators; },
      },
    };
  }

  it('reads the counts when the splash is open', async () => {
    const c = catalogue(1234, 56);
    const api = useSplashModal(state(), c.api);
    await flush();
    expect(api.driverCount.value).toBe(1234);
    expect(api.passiveRadiatorCount.value).toBe(56);
  });

  it('asks the catalogue nothing while the splash stays shut', async () => {
    const c = catalogue(1234, 56);
    useSplashModal(state(true), c.api);
    await flush();
    expect(c.asked).toEqual({drivers: 0, passiveRadiators: 0});
  });

  it('asks once, however often it is reopened', async () => {
    const c = catalogue(1234, 56);
    const api = useSplashModal(state(true), c.api);
    api.show();
    await flush();
    api.dismiss();
    api.show();
    await flush();
    expect(c.asked).toEqual({drivers: 1, passiveRadiators: 1});
  });

  it('leaves a count absent when the catalogue cannot answer — the splash is not a fault', async () => {
    const api = useSplashModal(state(), {
      driverCount: () => Promise.reject(new Error('not served')),
      passiveRadiatorCount: () => Promise.reject(new Error('not served')),
    });
    await flush();
    expect(api.driverCount.value).toBeNull();
    expect(api.passiveRadiatorCount.value).toBeNull();
  });
});

describe('useSplashModal — versions', () => {
  const view = {running: {version: '7.0.951', heading: 'OpenISD 7.0.951 · 1 Jan 2026', stamp: '20260101T0102Z'}};

  it('asks for the hosted builds only once the splash is on screen', async () => {
    let asked = 0;
    const api = useSplashModal(state(true), undefined, {view: async () => { asked++; return view; }});
    await flush();
    expect(asked).toBe(0);
    expect(api.versions.value).toBeNull();
    api.show();
    await flush();
    expect(asked).toBe(1);
    expect(api.versions.value).toEqual(view);
  });

  it('leaves the section out when the list cannot be described', async () => {
    const api = useSplashModal(state(), undefined, {view: () => Promise.reject(new Error('x'))});
    await flush();
    expect(api.versions.value).toBeNull();
  });
});
