import { newUuid } from '@openisd/design';
import {
  type DeviceName,
  type DocId,
  conflictCopyName,
  deviceNameOfBody,
  setDeviceModelInBody,
  wrapDoc,
  unwrapDoc,
} from '@openisd/design/cloud';
import type { KeptCopy, LocalDoc, LocalDocs, LocalRead } from '../localDocs.js';
import type { SavedEntries } from '../../repos/savedEntries.js';
import { createLayoutMigrator, type LayoutRules, type StoreData } from '../../repos/layoutMigration.js';
import { OPENISD_MY_DRIVERS_KEY, OPENISD_MY_PASSIVE_RADIATORS_KEY } from '../../repos/storageKeys.js';

export interface SavedEntryDocsDeps {
  readonly repo: SavedEntries<unknown>;
  readonly rules: LayoutRules;
  readonly now: () => number;
}

export function createSavedEntryDocs(deps: SavedEntryDocsDeps): LocalDocs {
  const { repo, rules } = deps;
  const { kind } = repo;
  const storeKey = kind === 'driver' ? OPENISD_MY_DRIVERS_KEY : OPENISD_MY_PASSIVE_RADIATORS_KEY;
  const migrator = createLayoutMigrator(rules);

  function list(): LocalRead {
    const read = repo.read();
    if (read.kind !== 'ok') return { kind: 'unreadable' };
    const docs: LocalDoc[] = read.entries.map(e => ({
      id: { kind, uuid: e.uuid },
      body: typeof e.value === 'string' ? e.value : JSON.stringify(e.value),
      layout: rules.layout,
    }));
    return { kind: 'ok', docs };
  }

  function put(doc: LocalDoc): 'done' | 'refused' {
    if (doc.id.kind !== kind) return 'refused';
    let record: unknown;
    try {
      record = JSON.parse(doc.body);
    } catch {
      return 'refused';
    }
    const res = repo.upsert(record, doc.id.uuid);
    return res !== null ? 'done' : 'refused';
  }

  function remove(id: DocId): 'done' | 'refused' {
    if (id.kind !== kind) return 'refused';
    const res = repo.removeById(id.uuid);
    return res === 'done' ? 'done' : 'refused';
  }

  function migrate(doc: LocalDoc): string | null {
    if (doc.id.kind !== kind) return null;
    if (doc.layout === rules.layout) return doc.body;
    if (doc.layout > rules.layout) return null;
    const wrapped: StoreData = wrapDoc(storeKey, doc.id, doc.body, doc.layout);
    const migrated = migrator.migrate(wrapped, doc.layout);
    if (migrated === null) return null;
    return unwrapDoc(storeKey, doc.id, migrated);
  }

  function putConflictCopy(doc: LocalDoc, from: DeviceName, at_ms: number): KeptCopy | 'refused' {
    if (doc.id.kind !== kind) return 'refused';
    const item = deviceNameOfBody(doc.body) ?? (kind === 'driver' ? 'Driver' : 'Passive radiator');
    const name = conflictCopyName(item, from, at_ms);
    const body = setDeviceModelInBody(doc.body, name);
    const id: DocId = { kind, uuid: newUuid() };
    if (put({ id, body, layout: rules.layout }) === 'refused') return 'refused';
    return { id, body, item, name };
  }

  return {
    kind,
    list,
    put,
    remove,
    migrate,
    putConflictCopy,
  };
}