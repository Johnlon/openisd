import { newUuid } from '@openisd/design';
import {
  type DeviceName,
  type DocId,
  conflictProjectName,
  setProjectNameInBody,
  wrapDoc,
  unwrapDoc,
} from '@openisd/design/cloud';
import type { LocalDoc, LocalDocs, LocalRead } from '../localDocs.js';
import type { ProjectRepo } from '../../repos/projectRepo.js';
import { createLayoutMigrator, type LayoutRules, type StoreData } from '../../repos/layoutMigration.js';
import { OPENISD_PROJECTS_KEY } from '../../repos/storageKeys.js';

export interface ProjectDocsDeps {
  readonly repo: ProjectRepo;
  readonly rules: LayoutRules;
  readonly now: () => number;
}

export function createProjectDocs(deps: ProjectDocsDeps): LocalDocs {
  const { repo, rules } = deps;
  const migrator = createLayoutMigrator(rules);

  function list(): LocalRead {
    const res = repo.storedDocs();
    if (res.kind === 'unreadable') return { kind: 'unreadable' };
    const docs: LocalDoc[] = res.docs.map(e => ({
      id: { kind: 'project', uuid: e.id },
      body: e.body,
      layout: e.layout,
    }));
    return { kind: 'ok', docs };
  }

  function put(doc: LocalDoc): 'done' | 'refused' {
    if (doc.id.kind !== 'project') return 'refused';
    return repo.putStoredDoc(doc.id.uuid, doc.body);
  }

  function remove(id: DocId): 'done' | 'refused' {
    if (id.kind !== 'project') return 'refused';
    return repo.removeStoredDoc(id.uuid);
  }

  function migrate(doc: LocalDoc): string | null {
    if (doc.id.kind !== 'project') return null;
    if (doc.layout === rules.layout) return doc.body;
    if (doc.layout > rules.layout) return null;
    const wrapped: StoreData = wrapDoc(OPENISD_PROJECTS_KEY, doc.id, doc.body, doc.layout);
    const migrated = migrator.migrate(wrapped, doc.layout);
    if (migrated === null) return null;
    return unwrapDoc(OPENISD_PROJECTS_KEY, doc.id, migrated);
  }

  function putConflictCopy(doc: LocalDoc, from: DeviceName, at_ms: number): { readonly id: DocId } | 'refused' {
    if (doc.id.kind !== 'project') return 'refused';
    const rawName = projectNameOfBody(doc.body) ?? 'Project';
    const conflictMark = conflictProjectName(rawName, from, at_ms);
    const newBody = setProjectNameInBody(doc.body, conflictMark);
    const newId = newUuid();
    const putRes = repo.putStoredDoc(newId, newBody);
    if (putRes === 'refused') return 'refused';
    return { id: { kind: 'project', uuid: newId } };
  }

  return {
    kind: 'project',
    list,
    put,
    remove,
    migrate,
    putConflictCopy,
  };
}

function projectNameOfBody(body: string): string | null {
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
    if ('label' in parsed && typeof parsed.label === 'string') return parsed.label;
    if ('meta' in parsed && typeof parsed.meta === 'object' && parsed.meta !== null && 'name' in parsed.meta && typeof parsed.meta.name === 'string') {
      return parsed.meta.name;
    }
    return null;
  } catch {
    return null;
  }
}