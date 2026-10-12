/**
 * `openStore` — the load rules. Same layout: silent. Older: back up, then migrate one layout at
 * a time. Newer: refuse the live store and offer a readable backup, read-only, or a raw export.
 * Layouts and steps are injected so the rules are proved without waiting for a real layout 2.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {BuildStamp, createBuildStamp} from '../src/repos/buildStamp.js';
import type {LayoutStep, StoreData} from '../src/repos/layoutMigration.js';
import {envelopeText, readEnvelope} from '../src/repos/storageSnapshot.js';
import {
  OPENISD_BACKUP_PREFIX, OPENISD_MY_DRIVERS_KEY, OPENISD_PROJECTS_KEY, OPENISD_STORAGE_BUILD_KEY, OPENISD_STORAGE_LAYOUT_KEY,
  OPENISD_STORAGE_LOG_KEY,
} from '../src/repos/storageKeys.js';
import {createStoreOpening, type StoreOpening} from '../src/repos/storeGate.js';
import {createMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {createQuotaStorage} from './fixtures/quotaStorage.js';
import {FIXED_NOW_MS} from './fixtures/repoOn.js';

const BUILD = createBuildStamp('v20260301T040506Z');
const OLD_BUILD = 'v20260101T0101Z';

/** Layout 1 -> 2 appends "+2" to the projects text; 2 -> 3 appends "+3": order is visible in the result. */
const STEPS: readonly LayoutStep[] = [1, 2].map((from): LayoutStep => ({
  from,
  migrate: (data: StoreData): StoreData => Object.fromEntries(
    Object.entries(data).map(([k, v]) => [k, k === OPENISD_PROJECTS_KEY ? `${v}+${from + 1}` : v])),
  migrateFile: file => file,
}));

const deps = (layout: number) => ({
  build: BUILD, now: () => FIXED_NOW_MS, rules: {layout, steps: STEPS}, memoryStorage: createMemoryStorage,
});

function ready(opening: StoreOpening) {
  assert.ok(opening.kind === 'ready', `expected ready, got ${opening.kind}`);
  return opening;
}

function backupKeys(storage: ListableStorage): string[] {
  return storage.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX));
}

function dump(storage: ListableStorage): Record<string, string | null> {
  return Object.fromEntries(storage.keys().sort().map(k => [k, storage.get(k)]));
}

const olderStore = () => createMemoryStorage({
  [OPENISD_PROJECTS_KEY]: 'projects', [OPENISD_MY_DRIVERS_KEY]: 'drivers',
  [OPENISD_STORAGE_LAYOUT_KEY]: '1', [OPENISD_STORAGE_BUILD_KEY]: OLD_BUILD,
});

describe('a store of this layout', () => {
  it('opens a fresh store as it is: no backup, nothing lost', () => {
    const storage = createMemoryStorage();
    const open = ready(createStoreOpening(storage, deps(3)));
    assert.deepEqual(open.lostKeys, []);
    assert.deepEqual(backupKeys(storage), []);
    assert.equal(open.readOnly, false);
  });

  it('opens silently: no backup, no migration, the data untouched', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: 'projects', [OPENISD_STORAGE_LAYOUT_KEY]: '3', [OPENISD_STORAGE_BUILD_KEY]: OLD_BUILD,
    });
    ready(createStoreOpening(storage, deps(3)));
    assert.deepEqual(backupKeys(storage), []);
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'projects');
    assert.equal(storage.get(OPENISD_STORAGE_BUILD_KEY), OLD_BUILD, 'swapping builds of one layout writes nothing until the app writes');
  });

  it('records the start in the storage log', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'p', [OPENISD_STORAGE_LAYOUT_KEY]: '3'});
    ready(createStoreOpening(storage, deps(3)));
    assert.ok(storage.get(OPENISD_STORAGE_LOG_KEY) !== null);
  });

  it('stamps the layout and build with every write the app makes', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: 'projects', [OPENISD_STORAGE_LAYOUT_KEY]: '3', [OPENISD_STORAGE_BUILD_KEY]: OLD_BUILD,
    });
    ready(createStoreOpening(storage, deps(3))).storage.set(OPENISD_MY_DRIVERS_KEY, 'a driver');
    assert.equal(storage.get(OPENISD_STORAGE_LAYOUT_KEY), '3');
    assert.equal(storage.get(OPENISD_STORAGE_BUILD_KEY), 'v20260301T0405Z');
  });

  it('reports a key that vanished since the last start', () => {
    const storage = createMemoryStorage({[OPENISD_MY_DRIVERS_KEY]: 'drivers', [OPENISD_STORAGE_LAYOUT_KEY]: '3'});
    ready(createStoreOpening(storage, deps(3)));
    storage.remove(OPENISD_MY_DRIVERS_KEY);
    const second = ready(createStoreOpening(storage, deps(3)));
    assert.deepEqual(second.lostKeys.map(l => l.key), [OPENISD_MY_DRIVERS_KEY]);
  });
});

describe('a store of an older layout', () => {
  it('backs the whole store up under the build that wrote it, then migrates one layout at a time', () => {
    const storage = olderStore();
    ready(createStoreOpening(storage, deps(3)));

    const backup = readEnvelope(storage.get(`${OPENISD_BACKUP_PREFIX}${OLD_BUILD}_20260101T010203Z`) ?? '');
    assert.ok(backup.kind === 'ok');
    assert.equal(backup.snapshot.layout, 1);
    assert.equal(backup.snapshot.data[OPENISD_PROJECTS_KEY], 'projects', 'the backup is the store before migration');

    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'projects+2+3', 'step 1->2 ran, then step 2->3');
    assert.equal(storage.get(OPENISD_STORAGE_LAYOUT_KEY), '3');
    assert.equal(storage.get(OPENISD_STORAGE_BUILD_KEY), 'v20260301T0405Z');
  });

  it('reads a store with data but no layout key as layout 1', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: 'projects'});
    ready(createStoreOpening(storage, deps(2)));
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'projects+2');
    assert.ok(storage.get(`${OPENISD_BACKUP_PREFIX}vunknown_20260101T010203Z`) !== null, 'named for an unknown build');
  });

  it('a second start is silent: no new backup, no new migration', () => {
    const storage = olderStore();
    ready(createStoreOpening(storage, deps(3)));
    const after = dump(storage);
    ready(createStoreOpening(storage, deps(3)));
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'projects+2+3');
    assert.deepEqual(backupKeys(storage), [`${OPENISD_BACKUP_PREFIX}${OLD_BUILD}_20260101T010203Z`]);
    assert.equal(storage.get(`${OPENISD_BACKUP_PREFIX}${OLD_BUILD}_20260101T010203Z`), after[`${OPENISD_BACKUP_PREFIX}${OLD_BUILD}_20260101T010203Z`]);
  });

  it('stops with an export-first answer when the backup does not fit, and changes nothing', () => {
    const storage = createQuotaStorage(300, {
      [OPENISD_PROJECTS_KEY]: 'p'.repeat(120), [OPENISD_STORAGE_LAYOUT_KEY]: '1', [OPENISD_STORAGE_BUILD_KEY]: OLD_BUILD,
    });
    const before = dump(storage);
    const opening = createStoreOpening(storage, deps(3));

    assert.ok(opening.kind === 'blocked');
    assert.equal(opening.reason, 'noRoom');
    assert.deepEqual(dump(storage), before);
    const exported = readEnvelope(opening.exportRaw());
    assert.ok(exported.kind === 'ok');
    assert.equal(exported.snapshot.data[OPENISD_PROJECTS_KEY], 'p'.repeat(120), 'the export holds the live data');
  });

  it('stops when a layout has no migration step', () => {
    const storage = olderStore();
    const opening = createStoreOpening(storage, {...deps(3), rules: {layout: 3, steps: []}});
    assert.ok(opening.kind === 'blocked');
    assert.equal(opening.reason, 'noStep');
  });
});

describe('a store of a newer layout', () => {
  const newerStore = () => createMemoryStorage({
    [OPENISD_PROJECTS_KEY]: 'projects from the future', [OPENISD_STORAGE_LAYOUT_KEY]: '4', [OPENISD_STORAGE_BUILD_KEY]: 'v20270101T0000Z',
    [`${OPENISD_BACKUP_PREFIX}v20260101T0000Z`]: envelopeText({
      layout: 2, build: BuildStamp.ofStored('v20260101T0000Z'), exportedAt: '20260101T000000Z', data: {[OPENISD_PROJECTS_KEY]: 'old projects'},
    }, false),
    [`${OPENISD_BACKUP_PREFIX}v20270101T0000Z`]: envelopeText({
      layout: 4, build: BuildStamp.ofStored('v20270101T0000Z'), exportedAt: '20270101T000000Z', data: {[OPENISD_PROJECTS_KEY]: 'newer backup'},
    }, false),
  });

  function newer(storage: ListableStorage) {
    const opening = createStoreOpening(storage, deps(3));
    assert.ok(opening.kind === 'newer');
    return opening;
  }

  it('does not open the live store, and writes nothing', () => {
    const storage = newerStore();
    const before = dump(storage);
    const opening = newer(storage);
    assert.equal(opening.storeLayout, 4);
    assert.deepEqual(dump(storage), before);
  });

  it('offers only backups this layout can read', () => {
    const opening = newer(newerStore());
    assert.deepEqual(opening.readable.map(b => b.layout), [2]);
  });

  it('offers a raw export of the live store', () => {
    const exported = readEnvelope(newer(newerStore()).exportRaw());
    assert.ok(exported.kind === 'ok');
    assert.equal(exported.snapshot.layout, 4);
    assert.equal(exported.snapshot.data[OPENISD_PROJECTS_KEY], 'projects from the future');
  });

  it('reads a backup read-only: the app runs on a copy in memory and the live store is not touched', () => {
    const storage = newerStore();
    const before = dump(storage);
    const opening = newer(storage).readOnly(`${OPENISD_BACKUP_PREFIX}v20260101T0000Z`);
    assert.ok(opening !== null);
    const open = ready(opening);
    assert.equal(open.readOnly, true);
    assert.equal(open.storage.get(OPENISD_PROJECTS_KEY), 'old projects+3', 'migrated up to this layout');
    open.storage.set(OPENISD_PROJECTS_KEY, 'edited in memory');
    assert.deepEqual(dump(storage), before);
  });

  it('will not read-only a backup of a layout it cannot read, or one that is not there', () => {
    const opening = newer(newerStore());
    assert.equal(opening.readOnly(`${OPENISD_BACKUP_PREFIX}v20270101T0000Z`), null);
    assert.equal(opening.readOnly(`${OPENISD_BACKUP_PREFIX}vnone`), null);
  });

  it('restores a backup into the live store after backing the live store up', () => {
    const storage = newerStore();
    const opening = newer(storage).restore(`${OPENISD_BACKUP_PREFIX}v20260101T0000Z`);

    ready(opening);
    assert.equal(storage.get(OPENISD_PROJECTS_KEY), 'old projects+3');
    assert.equal(storage.get(OPENISD_STORAGE_LAYOUT_KEY), '3');
    const live = readEnvelope(storage.get(`${OPENISD_BACKUP_PREFIX}v20270101T0000Z_20260101T010203Z`) ?? '');
    assert.ok(live.kind === 'ok');
    assert.equal(live.snapshot.layout, 4, 'the live store (layout 4, build v20270101T0000Z) was backed up first');
    assert.equal(live.snapshot.data[OPENISD_PROJECTS_KEY], 'projects from the future');
  });

  it('a restore that cannot be made leaves the store as it was, still refusing', () => {
    const storage = newerStore();
    const opening = newer(storage).restore(`${OPENISD_BACKUP_PREFIX}vnone`);
    assert.equal(opening.kind, 'newer');
  });
});
