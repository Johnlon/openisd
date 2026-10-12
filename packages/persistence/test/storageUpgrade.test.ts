/**
 * T055: every old layout loads into the current app, proved against golden dumps.
 *
 * `test/goldens/<case>` holds a full store dump as an app of each layout writes it
 * (`dump-layout-<K>.json`), and `expected.json`, what the current app yields from the case. A dump
 * is never edited once written: a later layout adds a file.
 *
 * The bump detector reads the goldens against STORAGE_LAYOUT. It decides the bump, not the author:
 *   - the loaders write a case's newest dump back differently  -> bump STORAGE_LAYOUT, add dumps;
 *   - STORAGE_LAYOUT was bumped but no case changed            -> the bump was not needed;
 *   - STORAGE_LAYOUT was bumped and a case lacks the new dump  -> add the dump.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {createBuildStamp} from '../src/repos/buildStamp.js';
import {createBackupRepo} from '../src/repos/backupRepo.js';
import {createExportedFiles} from '../src/repos/exportedFile.js';
import {createLayoutMigrator} from '../src/repos/layoutMigration.js';
import {readEnvelope} from '../src/repos/storageSnapshot.js';
import {OPENISD_BACKUP_PREFIX, OPENISD_STORAGE_LAYOUT_KEY} from '../src/repos/storageKeys.js';
import {createStoreOpening} from '../src/repos/storeGate.js';
import {STORAGE_LAYOUT} from '../src/storageLayout.js';
import {createMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {APP_RULES, FIXED_NOW_MS} from './fixtures/repoOn.js';
import {type Dump, goldenText, storeCases, type StoreCase} from './fixtures/goldens.js';
import {aDriverFromFile, aProjectFromFile, dumpOf, summaryOf, withoutMintedIds, writeBack} from './fixtures/storeSummary.js';

const BUILD = createBuildStamp('v20260301T040506Z');
const cases = storeCases();

function open(storage: ListableStorage) {
  return createStoreOpening(storage, {build: BUILD, now: () => FIXED_NOW_MS, rules: APP_RULES, memoryStorage: createMemoryStorage});
}

function ready(storage: ListableStorage) {
  const opening = open(storage);
  assert.ok(opening.kind === 'ready', `expected ready, got ${opening.kind}`);
  return opening;
}

const sorted = (dump: Dump): [string, string][] => Object.entries(dump).sort(([a], [b]) => a.localeCompare(b));
const born = (c: StoreCase) => Math.min(...c.dumps.keys());
const dumpAt = (c: StoreCase, layout: number): Dump => {
  const dump = c.dumps.get(layout);
  assert.ok(dump !== undefined, `case ${c.name} has no dump for layout ${layout}`);
  return dump;
};
const withoutLayoutKey = (dump: Dump): Dump => Object.fromEntries(Object.entries(dump).filter(([k]) => k !== OPENISD_STORAGE_LAYOUT_KEY));

describe('the goldens hold every case', () => {
  it('has the cases the task names', () => {
    assert.deepEqual(cases.map(c => c.name), ['custom-drivers', 'empty', 'many-projects', 'one-project', 'open-sessions', 'passive-radiators']);
  });
});

for (const c of cases) {
  describe(`case ${c.name}`, () => {
    const oldest = dumpAt(c, born(c));

    it('migrates one layout at a time, each step reproducing that layout\'s golden dump', () => {
      const reached: number[] = [];
      const migrated = createLayoutMigrator(APP_RULES).migrate(oldest, born(c), (layout, data) => {
        reached.push(layout);
        assert.deepEqual(sorted(withoutLayoutKey(data)), sorted(withoutLayoutKey(dumpAt(c, layout))), `layout ${layout}`);
      });
      assert.ok(migrated !== null);
      assert.deepEqual(reached, Array.from({length: STORAGE_LAYOUT - born(c)}, (_, i) => born(c) + 1 + i));
    });

    it('loads into the current app: backs up what the older build wrote, migrates, yields expected.json', () => {
      const raw = createMemoryStorage({...oldest});
      const opening = ready(raw);

      assert.deepEqual(sorted(dumpOf(raw)), sorted(dumpAt(c, STORAGE_LAYOUT)));
      assert.deepEqual(JSON.parse(JSON.stringify(summaryOf(opening.storage))), JSON.parse(goldenText(c.name, 'expected.json')));

      const backups = raw.keys().filter(k => k.startsWith(OPENISD_BACKUP_PREFIX));
      if (Object.keys(oldest).length === 0) {
        assert.deepEqual(backups, [], 'nothing was stored, so nothing is backed up');
        return;
      }
      assert.equal(backups.length, 1);
      assert.ok(backups[0].startsWith(`${OPENISD_BACKUP_PREFIX}vunknown_`), 'named for the build that wrote the store; a layout-1 store has no stamp');
      const backup = readEnvelope(raw.get(backups[0]) ?? '');
      assert.ok(backup.kind === 'ok');
      assert.equal(backup.snapshot.layout, born(c));
      assert.deepEqual(sorted(backup.snapshot.data), sorted(oldest));
    });

    it('a second load is silent: it writes nothing', () => {
      const raw = createMemoryStorage({...oldest});
      ready(raw);
      const writes: string[] = [];
      const watched: ListableStorage = {
        ...raw,
        get: key => raw.get(key),
        keys: () => raw.keys(),
        set: (key, value) => { if (raw.get(key) !== value) writes.push(key); raw.set(key, value); },
        remove: key => { writes.push(key); raw.remove(key); },
        watch: (key, onChange) => raw.watch(key, onChange),
      };
      ready(watched);
      assert.deepEqual(writes.filter(k => k !== 'openisd_storage_log'), [], 'only the start-up log may be written');
    });

    it('a dump at the current layout is a fixed point: load then write back reproduces it byte for byte', () => {
      const raw = createMemoryStorage({...dumpAt(c, STORAGE_LAYOUT)});
      writeBack(raw);
      // The one thing a load changes is the driver id the domain mints afresh inside each project text.
      assert.deepEqual(sorted(withoutMintedIds(dumpOf(raw))), sorted(withoutMintedIds(dumpAt(c, STORAGE_LAYOUT))),
        `${c.name}: the loaders now write layout ${STORAGE_LAYOUT} differently. Layout changed: bump STORAGE_LAYOUT, add a migration step and dump-layout-${STORAGE_LAYOUT + 1}.json for every case.`);
    });
  });
}

describe('the bump detector', () => {
  it('every case holds a dump for every layout from its birth up to STORAGE_LAYOUT', () => {
    for (const c of cases) {
      for (let layout = born(c); layout <= STORAGE_LAYOUT; layout++) {
        assert.ok(c.dumps.has(layout), `case ${c.name} lacks dump-layout-${layout}.json: add it for the new layout`);
      }
      assert.ok(Math.max(...c.dumps.keys()) <= STORAGE_LAYOUT, `case ${c.name} holds a dump newer than STORAGE_LAYOUT`);
    }
  });

  it('a bump changed something: some case differs between the previous layout and this one', () => {
    for (let layout = 2; layout <= STORAGE_LAYOUT; layout++) {
      const changed = cases.some(c => c.dumps.has(layout - 1) && c.dumps.has(layout)
        && JSON.stringify(sorted(withoutLayoutKey(dumpAt(c, layout - 1)))) !== JSON.stringify(sorted(withoutLayoutKey(dumpAt(c, layout)))));
      assert.ok(changed, `layout ${layout} changed no case: the bump was not needed`);
    }
  });

  it('no case shows a dump is edited: the oldest dump of each case is born in the layout its keys say', () => {
    for (const c of cases) {
      const oldest = dumpAt(c, born(c));
      const stamped = oldest[OPENISD_STORAGE_LAYOUT_KEY];
      assert.equal(stamped === undefined ? 1 : Number(stamped), born(c), c.name);
    }
  });
});

describe('case backup-file: a layout-1 backup file restores into the current app', () => {
  const file1 = goldenText('backup-file', 'file-layout-1.json');
  const file2 = goldenText('backup-file', 'file-layout-2.json');
  const expected: unknown = JSON.parse(goldenText('backup-file', 'expected.json'));

  function restoreInto() {
    const opening = ready(createMemoryStorage());
    const repo = createBackupRepo(opening.storage, opening.backup, () => FIXED_NOW_MS, APP_RULES);
    return {opening, repo};
  }

  it('restoring the layout-1 file migrates it, and exporting again writes the layout-2 file', () => {
    const {opening, repo} = restoreInto();
    assert.equal(repo.importAll(file1, {replaceEverything: true}).kind, 'ok');
    assert.deepEqual(JSON.parse(JSON.stringify(summaryOf(opening.storage))), expected);
    assert.equal(repo.exportAll(), file2);
  });

  it('the layout-2 file restores to the same store, and exports as itself', () => {
    const {opening, repo} = restoreInto();
    assert.equal(repo.importAll(file2, {replaceEverything: true}).kind, 'ok');
    assert.deepEqual(JSON.parse(JSON.stringify(summaryOf(opening.storage))), expected);
    assert.equal(repo.exportAll(), file2);
  });
});

describe('exported files: a layout-1 file opens, and the current app writes the layout-2 file', () => {
  const files = createExportedFiles(APP_RULES);

  for (const [name, ext, read] of [
    ['exported-driver-file', 'owdr', aDriverFromFile],
    ['exported-project-file', 'owpr', aProjectFromFile],
  ] as const) {
    it(`${name}: layout 1 and layout 2 read the same, and writing stamps the current layout`, () => {
      const file1 = goldenText(name, `file-layout-1.${ext}`);
      const file2 = goldenText(name, `file-layout-2.${ext}`);
      const expected: unknown = JSON.parse(goldenText(name, 'expected.json'));

      const fromOne = files.open(file1);
      const fromTwo = files.open(file2);
      assert.ok(fromOne.kind === 'ok' && fromTwo.kind === 'ok');
      assert.equal(fromOne.text, file1, 'a layout-1 file carries no stamp and no step changes it');
      assert.equal(fromTwo.text, file1, 'the stamp comes off, leaving the fields as they were');
      assert.deepEqual(Object.values(expected as Record<string, string>), [read(fromOne.text)]);
      assert.equal(files.stamp(fromTwo.text), file2, 'fixed point');
      assert.ok(file2.startsWith('{\n  "layout": 2,'));
    });
  }
});
