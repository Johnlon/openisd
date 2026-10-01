/**
 * Favourites: drivers and passive radiators each keep their own set, under their own key.
 * bugs/BUG_20260909_passive_radiators_cannot_be_favourited_at_all.md
 */
import {describe, expect, it} from 'vitest';
import {createPrefsRepo} from '../src/repos/prefsRepo.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {OPENISD_FAVOURITE_DRIVERS_KEY, OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY} from '../src/repos/storageKeys.js';

describe('prefsRepo — passive-radiator favourites', () => {
  it('are kept apart from driver favourites, each under its own key', () => {
    const storage = createMemoryStorage();
    const prefs = createPrefsRepo(storage);

    prefs.setFavorites(['driver-1']);
    prefs.setFavoritePassiveRadiators(['pr-1', 'pr-2']);

    expect(prefs.favorites()).toEqual(['driver-1']);
    expect(prefs.favoritePassiveRadiators()).toEqual(['pr-1', 'pr-2']);
    expect(storage.get(OPENISD_FAVOURITE_DRIVERS_KEY)).toBe('["driver-1"]');
    expect(storage.get(OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY)).toBe('["pr-1","pr-2"]');
  });

  it('read as none when nothing or something unreadable is stored', () => {
    expect(createPrefsRepo(createMemoryStorage()).favoritePassiveRadiators()).toEqual([]);
    const garbled = createMemoryStorage({[OPENISD_FAVOURITE_PASSIVE_RADIATORS_KEY]: '{not json'});
    expect(createPrefsRepo(garbled).favoritePassiveRadiators()).toEqual([]);
  });
});
