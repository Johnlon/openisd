/**
 * The driver list's filters (John, 17 Oct 2026: "empty wizard driver list with no hint"; "the list is empty
 * but the favourite button is selected visible"). Filters are kept between openings, but the list says which
 * are on; Favorites cannot be switched on with no favourites; one action clears every filter.
 */
import {describe, expect, it, vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {ref} from 'vue';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import {createBundledDriverRepo, createFileStorage, createMemoryStorage, createPrefsRepo} from '@openisd/persistence';
import type {Logging} from '../../src/logging/flash.js';
import {createDriverSelection} from '../../src/logic/driverSelection.js';
import {createDriverBrowsingState} from '../../src/logic/driverBrowsingState.js';
import {activeFilterLabels, type SearchCriteria} from '../../src/logic/driverDisplay.js';
import {DesignFiles} from '../../src/logic/fileImportExport.js';
import {ProjectFileFormat} from '../../src/fileFormat.js';
import {DriverScope} from '../../src/driverScope.js';
import {myDriverRepoOn, projectRepoOn, exportedFilesOn} from '../fixtures/repoOn.js';

const NONE: SearchCriteria = {
  query: '', typeStates: {}, fsMin: '', fsMax: '', sdMin: '', sdMax: '', selZ: [], favoritesOnly: false, favorites: [],
};

describe('activeFilterLabels: which filters are on, in words', () => {
  it('is empty when no filter is on', () => {
    expect(activeFilterLabels(NONE, DriverScope.All)).toEqual([]);
  });

  it('names every filter that is on', () => {
    expect(activeFilterLabels({
      ...NONE, query: ' W5-1138 ', typeStates: {tweet: 'include', sub: 'exclude'},
      fsMin: '20', fsMax: '40', sdMin: '90', selZ: ['4', '8'], favoritesOnly: true,
    }, DriverScope.Mine)).toEqual([
      '"W5-1138"', 'not Sub', 'Tweet', 'Fs 20–40 Hz', 'Sd ≥ 90 cm²', 'Z 4Ω or 8Ω', 'My Drivers only', 'Favorites',
    ]);
  });

  it('names a maximum alone', () => {
    expect(activeFilterLabels({...NONE, fsMax: '40'}, DriverScope.Bundled)).toEqual(['Fs ≤ 40 Hz', 'Bundled only']);
  });
});

describe('the driver list filters', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const GOLDEN = join(here, '..', '..', '..', 'design', 'test', 'winisd', 'fixtures', 'winisd-parity', 'goldens', 'sealed-small.wpr');

  function setUp() {
    const {appState, presentation} = createAppStateFixture();
    const engine = appState.engine;
    const storage = createMemoryStorage();
    const files = new DesignFiles(engine, projectRepoOn(engine, createFileStorage(), storage, 'http://localhost'), exportedFilesOn());
    const logging: Logging = {message: ref(''), flash: vi.fn()};
    const myDriverRepo = myDriverRepoOn(storage, engine);
    const project = files.projectFromText(readFileSync(GOLDEN, 'utf8'), ProjectFileFormat.Wpr).value;
    if (!project) throw new Error('the golden must load');
    const saved = myDriverRepo.upsert(project.driver);
    if (!saved) throw new Error('the driver must save');
    const browsing = createDriverBrowsingState({
      driverRepo: createBundledDriverRepo({
        fetch: () => Promise.reject(new Error('fetch not used')), baseUrl: '/', engine, maxAge_ms: 1, now: Date.now,
      }),
      myDriverRepo, prefs: createPrefsRepo(storage, () => undefined), logging,
      selection: createDriverSelection({appState, presentation}), files, confirmReset: {ask: async () => true},
      exportNotice: {exported: () => undefined}, appState, presentation,
    });
    browsing.reloadMyDrivers();
    return {browsing, uuid: saved.uuid, driverUuid: project.driver.uuid()};
  }

  it('Favorites cannot be switched on with no favourites', () => {
    const {browsing} = setUp();
    expect(browsing.favoritesAvailable.value).toBe(false);
    browsing.toggleFavoritesOnly();
    expect(browsing.favoritesOnly.value).toBe(false);
  });

  it('a starred driver is listed under Favorites', () => {
    const {browsing} = setUp();
    const row = browsing.myDrivers.value[0];
    browsing.toggleFavorite(browsing.driverId(row.driver));
    expect(browsing.favoritesAvailable.value).toBe(true);
    browsing.toggleFavoritesOnly();
    expect(browsing.favoritesOnly.value).toBe(true);
    expect(browsing.filteredMyDrivers.value.map(r => r.uuid)).toEqual([row.uuid]);
  });

  it('un-starring the last favourite switches Favorites off, so the list is not left empty', () => {
    const {browsing} = setUp();
    const id = browsing.driverId(browsing.myDrivers.value[0].driver);
    browsing.toggleFavorite(id);
    browsing.toggleFavoritesOnly();
    browsing.toggleFavorite(id);
    expect(browsing.favoritesOnly.value).toBe(false);
    expect(browsing.filteredMyDrivers.value).toHaveLength(1);
  });

  it('says which filters are on, and Clear filters clears every one', () => {
    const {browsing} = setUp();
    browsing.toggleFavorite(browsing.driverId(browsing.myDrivers.value[0].driver));
    browsing.filterQ.value = 'nothing like this';
    browsing.toggleType('tweet');
    browsing.fsMin.value = '20'; browsing.sdMax.value = '300';
    browsing.toggleZ('4');
    browsing.toggleFavoritesOnly();
    browsing.cycleDriverScope();
    expect(browsing.filtersOn.value).toBe(true);
    expect(browsing.activeFilters.value).toHaveLength(7);
    expect(browsing.listedCount.value).toBe(0);

    browsing.clearAllFilters();
    expect(browsing.activeFilters.value).toEqual([]);
    expect(browsing.filtersOn.value).toBe(false);
    expect(browsing.driverScope.value).toBe(DriverScope.All);
    expect(browsing.favoritesOnly.value).toBe(false);
    expect(browsing.filteredMyDrivers.value).toHaveLength(1);
  });
});
