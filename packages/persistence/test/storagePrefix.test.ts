import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {StoragePrefix, createLocalStorage, createStoragePrefix} from '../src/index.js';

/** A `localStorage` whose own enumerable properties are the held keys, as the browser's is, so two
 *  deployments can share one origin's storage. Returns the held entries. */
function fakeLocalStorage(): () => string[] {
  const fake: Record<string, string> = {};
  const method = (name: string, fn: (key: string, value: string) => unknown) =>
    Object.defineProperty(fake, name, {value: fn, enumerable: false});
  method('getItem', key => Object.hasOwn(fake, key) ? fake[key] : null);
  method('setItem', (key, value) => { fake[key] = value; });
  method('removeItem', key => { delete fake[key]; });
  vi.stubGlobal('localStorage', fake);
  return () => Object.keys(fake);
}

describe('createStoragePrefix', () => {
  it('gives the root app no prefix, so its keys stay as they are', () => {
    expect(createStoragePrefix('/').stored('openisd_state')).toBe('openisd_state');
    expect(createStoragePrefix('/index.html').stored('openisd_state')).toBe('openisd_state');
  });

  it('gives /test/ a prefix of its own', () => {
    expect(createStoragePrefix('/test/').stored('openisd_state')).toBe('test/openisd_state');
    expect(createStoragePrefix('/test/index.html').stored('openisd_state')).toBe('test/openisd_state');
  });

  it('leaves every other deployment on the root store', () => {
    expect(createStoragePrefix('/snap/20261015-1/').stored('openisd_state')).toBe('openisd_state');
    expect(createStoragePrefix('/v/20261015-1/').stored('openisd_state')).toBe('openisd_state');
    expect(createStoragePrefix('/testing/').stored('openisd_state')).toBe('openisd_state');
  });

  it('knows which stored keys are its own', () => {
    const test = createStoragePrefix('/test/');
    expect(test.own('test/openisd_view')).toBe('openisd_view');
    expect(test.own('openisd_view')).toBeNull();
    expect(StoragePrefix.ROOT.own('openisd_view')).toBe('openisd_view');
    expect(StoragePrefix.ROOT.own('test/openisd_view')).toBeNull();
  });
});

describe('createLocalStorage under a prefix', () => {
  let heldKeys: () => string[];
  beforeEach(() => { heldKeys = fakeLocalStorage(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('keeps /test/ and the root app apart in one origin', () => {
    const root = createLocalStorage(createStoragePrefix('/'));
    const test = createLocalStorage(createStoragePrefix('/test/'));
    root.set('openisd_projects', 'real');
    test.set('openisd_projects', 'scratch');
    expect(root.get('openisd_projects')).toBe('real');
    expect(test.get('openisd_projects')).toBe('scratch');
    expect(heldKeys().sort()).toEqual(['openisd_projects', 'test/openisd_projects']);
  });

  it('lists only its own keys, under the names the app uses', () => {
    const root = createLocalStorage(createStoragePrefix('/'));
    const test = createLocalStorage(createStoragePrefix('/test/'));
    root.set('openisd_view', 'a');
    test.set('openisd_state', 'b');
    expect(root.keys()).toEqual(['openisd_view']);
    expect(test.keys()).toEqual(['openisd_state']);
  });

  it('removes only its own key', () => {
    const root = createLocalStorage(createStoragePrefix('/'));
    const test = createLocalStorage(createStoragePrefix('/test/'));
    root.set('openisd_view', 'a');
    test.set('openisd_view', 'b');
    test.remove('openisd_view');
    expect(root.get('openisd_view')).toBe('a');
    expect(test.get('openisd_view')).toBeNull();
  });
});
