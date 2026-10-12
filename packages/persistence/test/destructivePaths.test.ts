/**
 * EVERY destructive path backs the whole store up first (T058; John, 12 Oct 2026: "a backup MUST
 * ALWAYS take place, there is no path without it").
 *
 * A destructive path is any app path that removes or replaces a stored key: restore, delete,
 * migrate, repair write-back, reset. The table below names each one. For each, the test proves:
 *   1. a backup of the store as it was exists once the path has run,
 *   2. it was written BEFORE the first change to any other key,
 *   3. when the backup cannot be made (no room), the path is refused and the data is kept.
 * A new destructive path goes in this table; one that is not here is not proved.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createEngine} from '@openisd/design/engine';
import {createBuildStamp} from '../src/repos/buildStamp.js';
import {APP_SETTINGS_KEY} from '../src/repos/appSettingsRepo.js';
import {createBackupRepo} from '../src/repos/backupRepo.js';
import type {LayoutStep} from '../src/repos/layoutMigration.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {createSavedEntries} from '../src/repos/savedEntries.js';
import {readEnvelope} from '../src/repos/storageSnapshot.js';
import {
  OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY, OPENISD_OPEN_SESSIONS_KEY,
  OPENISD_PROJECTS_KEY, OPENISD_STATE_KEY, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY, OPENISD_STORAGE_LOG_KEY,
  OPENISD_VIEW_KEY,
} from '../src/repos/storageKeys.js';
import {createStoreOpening} from '../src/repos/storeGate.js';
import {VIEW_STATE_KEY} from '../src/repos/viewStateRepo.js';
import {
  APP_RULES, appSettingsRepoOn, backupOn, FIXED_NOW_MS, myDriverRepoOn, myPassiveRadiatorRepoOn, projectRepoOn, viewStateRepoOn,
} from './fixtures/repoOn.js';
import {goodProjectText, projectWithABadField, projectWithFrontQicl} from './fixtures/projectTexts.js';
import {createQuotaStorage} from './fixtures/quotaStorage.js';
import {aDriver, aRadiator} from './fixtures/savedRecords.js';

const engine = createEngine();
const noFiles: FileStorage = {
  save: () => { throw new Error('no file is written here'); },
  saveAs: () => { throw new Error('no file is written here'); },
  openFileName: () => null,
  forget: () => { throw new Error('no file is written here'); },
};
const OLD_BUILD = 'v20260101T0101Z';
const BACKUP_KEY = `${OPENISD_BACKUP_PREFIX}${OLD_BUILD}`;
const ADDRESS = 'http://localhost';

interface DestructivePath {
  readonly name: string;
  /** The store as the path finds it. */
  readonly seed: () => Record<string, string>;
  /** The keys the path removes or replaces — the backup must hold them as seeded. */
  readonly destroys: readonly string[];
  readonly act: (storage: ListableStorage) => void;
}

function dumpOf(build: (storage: ListableStorage) => void): Record<string, string> {
  const scratch = createMemoryStorage();
  build(scratch);
  return Object.fromEntries(scratch.keys().map(k => [k, scratch.get(k) ?? '']));
}

const withDrivers = (): Record<string, string> => dumpOf(s => { myDriverRepoOn(s, engine).upsert(aDriver()); });
const withRadiators = (): Record<string, string> => dumpOf(s => { myPassiveRadiatorRepoOn(s).upsert(aRadiator()); });
const projectsOf = (...texts: string[]): string => JSON.stringify({
  version: 1, entries: texts.map((text, i) => ({id: `id-${i + 1}`, text, modified: `2026-01-0${i + 1}T00:00:00Z`})),
});
const sessionOf = (text: string): string => JSON.stringify({entries: [{id: 's-1', text, modified: '', traceHidden: false}], focusedId: 's-1'});

const BACKUP_FILE = JSON.stringify({
  openisdBackup: true, schemaVersion: 1, layout: 1, exportedAt: '20260101T000000Z',
  data: {[OPENISD_PROJECTS_KEY]: '{"version":1,"entries":[]}'},
});

const STEP_1_TO_2: LayoutStep = {from: 1, migrate: data => Object.fromEntries(Object.entries(data).map(([k, v]) => [k, `${v}`]))};

const PATHS: readonly DestructivePath[] = [
  // --- restore
  {
    name: 'restore, keeping keys the file lacks',
    seed: () => ({...withDrivers(), [OPENISD_PROJECTS_KEY]: projectsOf(goodProjectText('mine'))}),
    destroys: [OPENISD_PROJECTS_KEY],
    act: s => { createBackupRepo(s, backupOn(s), () => FIXED_NOW_MS, APP_RULES).importAll(BACKUP_FILE, {replaceEverything: false}); },
  },
  {
    name: 'restore, replacing everything',
    seed: () => ({...withDrivers(), [OPENISD_PROJECTS_KEY]: projectsOf(goodProjectText('mine'))}),
    destroys: [OPENISD_MY_DRIVERS_KEY, OPENISD_PROJECTS_KEY],
    act: s => { createBackupRepo(s, backupOn(s), () => FIXED_NOW_MS, APP_RULES).importAll(BACKUP_FILE, {replaceEverything: true}); },
  },
  // --- delete
  {
    name: 'delete a saved driver',
    seed: withDrivers,
    destroys: [OPENISD_MY_DRIVERS_KEY],
    act: s => { const repo = myDriverRepoOn(s, engine); repo.remove(repo.list()[0].uuid); },
  },
  {
    name: 'delete a broken saved driver entry',
    seed: () => ({[OPENISD_MY_DRIVERS_KEY]: JSON.stringify({schema: 1, entries: [{uuid: 'u-1', record: {not: 'a driver'}}]})}),
    destroys: [OPENISD_MY_DRIVERS_KEY],
    act: s => { myDriverRepoOn(s, engine).removeBroken(0); },
  },
  {
    name: 'delete all saved drivers',
    seed: withDrivers,
    destroys: [OPENISD_MY_DRIVERS_KEY],
    act: s => { myDriverRepoOn(s, engine).deleteAll(); },
  },
  {
    name: 'replace all saved drivers',
    seed: withDrivers,
    destroys: [OPENISD_MY_DRIVERS_KEY],
    act: s => { myDriverRepoOn(s, engine).replaceAll([]); },
  },
  {
    name: 'delete a saved passive radiator',
    seed: withRadiators,
    destroys: [OPENISD_MY_PASSIVE_RADIATORS_KEY],
    act: s => { const repo = myPassiveRadiatorRepoOn(s); repo.remove(repo.list()[0].uuid); },
  },
  {
    name: 'delete a broken saved passive radiator entry',
    seed: () => ({[OPENISD_MY_PASSIVE_RADIATORS_KEY]: JSON.stringify({schema: 1, entries: [{uuid: 'u-1', record: {not: 'a radiator'}}]})}),
    destroys: [OPENISD_MY_PASSIVE_RADIATORS_KEY],
    act: s => { myPassiveRadiatorRepoOn(s).removeBroken(0); },
  },
  {
    name: 'delete all saved passive radiators',
    seed: withRadiators,
    destroys: [OPENISD_MY_PASSIVE_RADIATORS_KEY],
    act: s => { myPassiveRadiatorRepoOn(s).deleteAll(); },
  },
  {
    name: 'replace all saved passive radiators',
    seed: withRadiators,
    destroys: [OPENISD_MY_PASSIVE_RADIATORS_KEY],
    act: s => { myPassiveRadiatorRepoOn(s).replaceAll([]); },
  },
  // --- migrate
  {
    // No saved list is on a newer schema yet; the write-back is proved on the shared envelope.
    name: 'migrate a saved list written under an older schema',
    seed: () => ({[OPENISD_MY_DRIVERS_KEY]: JSON.stringify({schema: 1, entries: [{uuid: 'u-1', record: 'a record'}]})}),
    destroys: [OPENISD_MY_DRIVERS_KEY],
    act: s => {
      createSavedEntries<string>(s, {
        key: OPENISD_MY_DRIVERS_KEY, schemaVersion: 2,
        open: record => typeof record === 'string' ? record : ['not text'],
        snapshot: value => value,
      }, backupOn(s)).read();
    },
  },
  {
    name: 'migrate saved projects: merge copies of one project at start-up',
    seed: () => ({[OPENISD_PROJECTS_KEY]: projectsOf(goodProjectText('mine'), goodProjectText('mine'))}),
    destroys: [OPENISD_PROJECTS_KEY],
    act: s => { projectRepoOn(engine, noFiles, s, ADDRESS); },
  },
  {
    name: 'migrate saved projects: a retired field at start-up',
    seed: () => ({[OPENISD_PROJECTS_KEY]: projectsOf(projectWithFrontQicl('bp4'))}),
    destroys: [OPENISD_PROJECTS_KEY],
    act: s => { projectRepoOn(engine, noFiles, s, ADDRESS); },
  },
  {
    name: 'migrate open sessions: a retired field at start-up',
    seed: () => ({[OPENISD_OPEN_SESSIONS_KEY]: sessionOf(projectWithFrontQicl('bp4'))}),
    destroys: [OPENISD_OPEN_SESSIONS_KEY],
    act: s => { projectRepoOn(engine, noFiles, s, ADDRESS); },
  },
  {
    name: 'migrate the autosaved project: a retired field at start-up',
    seed: () => ({[OPENISD_STATE_KEY]: projectWithFrontQicl('bp4')}),
    destroys: [OPENISD_STATE_KEY],
    act: s => { projectRepoOn(engine, noFiles, s, ADDRESS); },
  },
  {
    name: 'migrate the whole store to a newer storage layout',
    seed: () => ({...withDrivers(), [OPENISD_PROJECTS_KEY]: projectsOf(goodProjectText('mine'))}),
    destroys: [OPENISD_MY_DRIVERS_KEY, OPENISD_PROJECTS_KEY],
    act: s => {
      createStoreOpening(s, {build: createBuildStamp('v20260301T040506Z'), now: () => FIXED_NOW_MS, memoryStorage: createMemoryStorage, rules: {layout: 2, steps: [{
        from: STEP_1_TO_2.from, migrate: data => ({...data, [OPENISD_PROJECTS_KEY]: 'migrated'}),
      }]}});
    },
  },
  // --- repair write-back
  {
    name: 'repair a saved project with a field the schema refuses',
    seed: () => ({[OPENISD_PROJECTS_KEY]: projectsOf(projectWithABadField('p'))}),
    destroys: [OPENISD_PROJECTS_KEY],
    act: s => { projectRepoOn(engine, noFiles, s, ADDRESS).loadStoredProject('id-1'); },
  },
  {
    name: 'repair an open session entry with a field the schema refuses',
    seed: () => ({[OPENISD_OPEN_SESSIONS_KEY]: sessionOf(projectWithABadField('p'))}),
    destroys: [OPENISD_OPEN_SESSIONS_KEY],
    act: s => { projectRepoOn(engine, noFiles, s, ADDRESS).loadOpenProjects(); },
  },
  {
    name: 'repair the autosaved project with a field the schema refuses',
    seed: () => ({[OPENISD_STATE_KEY]: projectWithABadField('p')}),
    destroys: [OPENISD_STATE_KEY],
    act: s => { projectRepoOn(engine, noFiles, s, ADDRESS).loadFromStorage(); },
  },
  {
    name: 'save the view over a stored view that cannot be read',
    seed: () => ({[VIEW_STATE_KEY]: 'not json'}),
    destroys: [OPENISD_VIEW_KEY],
    act: s => { viewStateRepoOn(s).save({ui: {}}); },
  },
  {
    name: 'save Options over stored Options that cannot be read',
    seed: () => ({[APP_SETTINGS_KEY]: 'not json'}),
    destroys: [APP_SETTINGS_KEY],
    act: s => { appSettingsRepoOn(s).setDifferenceCuesShown(false); },
  },
  // --- reset
  {
    name: 'reset the view',
    seed: () => ({[VIEW_STATE_KEY]: JSON.stringify({ui: {username: 'John'}})}),
    destroys: [OPENISD_VIEW_KEY],
    act: s => { viewStateRepoOn(s).reset(); },
  },
  {
    name: 'reset Options',
    seed: () => ({[APP_SETTINGS_KEY]: JSON.stringify({vented: {minVb_m3: 0.001, maxVb_m3: 1, minFb_hz: 10, maxFb_hz: 200}})}),
    destroys: [APP_SETTINGS_KEY],
    act: s => { appSettingsRepoOn(s).reset(); },
  },
];

/** `inner`, remembering every change made to it, in order. */
function recording(inner: ListableStorage): {storage: ListableStorage; changes: string[]} {
  const changes: string[] = [];
  return {
    changes,
    storage: {
      ...inner,
      set(key, value) { changes.push(key); inner.set(key, value); },
      remove(key) { changes.push(key); inner.remove(key); },
    },
  };
}

function stamped(seed: Record<string, string>): Record<string, string> {
  return {...seed, [OPENISD_STORAGE_LAYOUT_KEY]: '1', [OPENISD_STORAGE_BUILD_KEY]: OLD_BUILD};
}

const isBackupKey = (key: string) => key.startsWith(OPENISD_BACKUP_PREFIX);
const isBookkeeping = (key: string) => isBackupKey(key) || key === OPENISD_STORAGE_LOG_KEY
  || key === OPENISD_STORAGE_LAYOUT_KEY || key === OPENISD_STORAGE_BUILD_KEY;

describe('every destructive path backs the whole store up first', () => {
  it('the table names at least restore, delete, migrate, repair and reset', () => {
    for (const word of ['restore', 'delete', 'migrate', 'repair', 'reset']) {
      assert.ok(PATHS.some(p => p.name.startsWith(word)), `no ${word} path in the table`);
    }
  });

  for (const path of PATHS) {
    describe(path.name, () => {
      it('leaves a backup of the store as it was', () => {
        const seed = stamped(path.seed());
        const storage = createMemoryStorage(seed);
        path.act(storage);

        const read = readEnvelope(storage.get(BACKUP_KEY) ?? '');
        assert.ok(read.kind === 'ok', `no readable backup under ${BACKUP_KEY}`);
        for (const key of path.destroys) {
          assert.equal(read.snapshot.data[key], seed[key], `the backup does not hold ${key} as it was`);
        }
      });

      it('writes the backup before it changes anything else', () => {
        const {storage, changes} = recording(createMemoryStorage(stamped(path.seed())));
        path.act(storage);

        const firstBackup = changes.findIndex(isBackupKey);
        const firstChange = changes.findIndex(key => !isBookkeeping(key));
        assert.ok(firstBackup >= 0, 'no backup was written');
        assert.ok(firstChange < 0 || firstBackup < firstChange, `${changes[firstChange]} changed before the backup was written`);
      });

      it('is refused, and the data kept, when the backup does not fit', () => {
        const seed = stamped(path.seed());
        const used = Object.entries(seed).reduce((sum, [k, v]) => sum + k.length + v.length, 0);
        const storage = createQuotaStorage(used + 40, seed);
        path.act(storage);

        for (const key of path.destroys) {
          assert.equal(storage.get(key), seed[key], `${key} changed although no backup could be made`);
        }
      });
    });
  }
});
