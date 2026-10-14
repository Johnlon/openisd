/**
 * Compacting the stored project texts must be invisible to Cloud sync (T156): the ledger hash of a
 * project nobody edited follows its rewritten text, so no project counts as changed on this device
 * and nothing is pushed.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {BodyHash, FileId, RevisionId, bodyHashOf, type DocId} from '@openisd/design/cloud';
import {createEngine} from '@openisd/design/engine';
import {createProjectDocs} from '../../src/cloud/docs/projectDocs.js';
import {createLedgerFollowsRewrite} from '../../src/cloud/ledgerFollowsRewrite.js';
import {createSyncLedger, type SyncLedger} from '../../src/cloud/syncLedger.js';
import {createStoredTextCompaction} from '../../src/repos/storedTextCompaction.js';
import {OPENISD_PROJECTS_KEY} from '../../src/repos/storageKeys.js';
import {createMemoryStorage, type ListableStorage} from '../../src/storage/keyValueStorage.js';
import type {FileStorage} from '../../src/storage/fileStorage.js';
import {APP_RULES, backupOn, projectRepoOn} from '../fixtures/repoOn.js';

const noFiles: FileStorage = {
  save: () => { throw new Error('no file'); },
  saveAs: () => { throw new Error('no file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no file'); },
};

const randomBytes = () => new Uint8Array([1, 2, 3, 4]);
/** An older build's stored text: indented, and the embedded driver still carries its readings and marks. */
const pretty = (name: string) => JSON.stringify({
  label: name,
  saved: {
    spec: {Fs: {value: 45, dq_calculated: [{rule: 'x'}]}},
    driverEmbedding: {device: {
      uuid: {value: 'u'}, brand: {value: 'B', origin: 'datasheet'}, model: {value: 'M'},
      categories: {value: []}, description: {value: 'long text'},
      specs: {woofer: {Fs_hz: {state: 'E', value: 45, origin: 'datasheet', readings: {datasheet: {read_value: 45, read_precision: 0.5}}, dq_scraper: []}}},
    }},
  },
  edited: null,
}, null, 2);
const projectId = (uuid: string): DocId => ({kind: 'project', uuid});

function hashOrFail(text: string): BodyHash {
  const hash = bodyHashOf(text);
  if (hash === null) throw new Error('not hashable');
  return hash;
}

function syncedRow(uuid: string, text: string) {
  const fileId = FileId.of('f-' + uuid);
  const revision = RevisionId.of('r-' + uuid);
  if (fileId === null || revision === null) throw new Error('ids');
  return {id: projectId(uuid), fileId, revision, hash: hashOrFail(text), seq: 1};
}

/** Projects stored on this device, each already synced: the ledger's hash is its text's hash. */
function syncedStore(texts: Readonly<Record<string, string>>): {storage: ListableStorage; ledger: SyncLedger} {
  const storage = createMemoryStorage({
    [OPENISD_PROJECTS_KEY]: JSON.stringify({entries: Object.entries(texts).map(([id, text]) => ({id, text, modified: ''}))}),
  });
  const ledger = createSyncLedger({storage, random: randomBytes});
  for (const [id, text] of Object.entries(texts)) ledger.set(syncedRow(id, text));
  return {storage, ledger};
}

/** The projects this device would push: no ledger row, or a row whose hash is not the text's. */
function pendingProjects(storage: ListableStorage, ledger: SyncLedger): number {
  const docs = createProjectDocs({repo: projectRepoOn(createEngine(), noFiles, storage, 'http://localhost'), rules: APP_RULES, now: () => 0});
  const read = docs.list();
  if (read.kind !== 'ok') throw new Error('unreadable');
  return read.docs.filter(doc => ledger.row(doc.id)?.hash.toString() !== bodyHashOf(doc.body)?.toString()).length;
}

describe('compacting stored project texts, seen by Cloud sync', () => {
  it('leaves no project pending when the ledger follows the rewrite', () => {
    const {storage, ledger} = syncedStore({a: pretty('one'), b: pretty('two')});
    assert.equal(pendingProjects(storage, ledger), 0);

    const outcome = createStoredTextCompaction(storage, backupOn(storage), createLedgerFollowsRewrite(storage, randomBytes)).run();

    assert.equal(outcome.kind, 'rewritten');
    assert.equal(pendingProjects(storage, ledger), 0);
  });

  it('also follows the slimming of the embedded driver', () => {
    const {storage, ledger} = syncedStore({a: pretty('one')});
    createStoredTextCompaction(storage, backupOn(storage), createLedgerFollowsRewrite(storage, randomBytes)).run();

    const stored = storage.get(OPENISD_PROJECTS_KEY) ?? '';
    assert.equal(stored.includes('readings'), false);
    assert.equal(stored.includes('categories'), false);
    assert.equal(pendingProjects(storage, ledger), 0);
  });

  it('would leave every project pending if the ledger did not follow', () => {
    const {storage, ledger} = syncedStore({a: pretty('one'), b: pretty('two')});
    createStoredTextCompaction(storage, backupOn(storage), () => undefined).run();
    assert.equal(pendingProjects(storage, ledger), 2);
  });

  it('keeps the ledger row otherwise unchanged', () => {
    const {storage, ledger} = syncedStore({a: pretty('one')});
    const before = ledger.row(projectId('a'));
    createStoredTextCompaction(storage, backupOn(storage), createLedgerFollowsRewrite(storage, randomBytes)).run();
    const after = ledger.row(projectId('a'));
    assert.equal(after?.revision.toString(), before?.revision.toString());
    assert.equal(after?.fileId.toString(), before?.fileId.toString());
    assert.equal(after?.seq, before?.seq);
  });

  it('leaves a project edited here since its last sync pending', () => {
    const {storage, ledger} = syncedStore({a: pretty('one')});
    ledger.set(syncedRow('a', pretty('one as last synced')));
    createStoredTextCompaction(storage, backupOn(storage), createLedgerFollowsRewrite(storage, randomBytes)).run();
    assert.equal(pendingProjects(storage, ledger), 1);
  });

  it('leaves a project the ledger does not know pending, as it was', () => {
    const {storage, ledger} = syncedStore({a: pretty('one')});
    ledger.drop(projectId('a'));
    createStoredTextCompaction(storage, backupOn(storage), createLedgerFollowsRewrite(storage, randomBytes)).run();
    assert.equal(ledger.row(projectId('a')), null);
  });

  it('writes no ledger on a device that never synced', () => {
    const storage = createMemoryStorage({
      [OPENISD_PROJECTS_KEY]: JSON.stringify({entries: [{id: 'a', text: pretty('one'), modified: ''}]}),
    });
    createStoredTextCompaction(storage, backupOn(storage), createLedgerFollowsRewrite(storage, randomBytes)).run();
    assert.equal(storage.keys().some(key => key.startsWith('openisd_cloud_')), false);
  });
});
