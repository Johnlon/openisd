import {
  type DeviceId,
  type DocId,
  wrapDoc,
  unwrapDoc,
} from '@openisd/design/cloud';
import type { LocalDoc, LocalDocs, LocalRead } from '../localDocs.js';
import type { SingletonDocRepo } from '../../repos/appSettingsRepo.js';
import { createLayoutMigrator, type LayoutRules, type StoreData } from '../../repos/layoutMigration.js';
import { OPENISD_APP_SETTINGS_KEY, OPENISD_FAVOURITE_DRIVERS_KEY } from '../../repos/storageKeys.js';

export interface SingletonDocsDeps {
  readonly repo: SingletonDocRepo;
  readonly rules: LayoutRules;
  readonly now: () => number;
}

export function createSingletonDocs(deps: SingletonDocsDeps): LocalDocs {
  const { repo, rules } = deps;
  const { kind } = repo;
  const storeKey = kind === 'settings' ? OPENISD_APP_SETTINGS_KEY : OPENISD_FAVOURITE_DRIVERS_KEY;
  const migrator = createLayoutMigrator(rules);

  function list(): LocalRead {
    const res = repo.readDoc();
    if (res.kind === 'unreadable') return { kind: 'unreadable' };
    if (res.body === null) return { kind: 'ok', docs: [] };
    return {
      kind: 'ok',
      docs: [{ id: { kind }, body: res.body, layout: rules.layout }],
    };
  }

  function put(doc: LocalDoc): 'done' | 'refused' {
    if (doc.id.kind !== kind) return 'refused';
    return repo.replaceDoc(doc.body);
  }

  function remove(id: DocId): 'done' | 'refused' {
    if (id.kind !== kind) return 'refused';
    return repo.removeDoc();
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

  function putConflictCopy(_doc: LocalDoc, _from: DeviceId, _at_ms: number): { readonly id: DocId } | 'refused' {
    return 'refused';
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