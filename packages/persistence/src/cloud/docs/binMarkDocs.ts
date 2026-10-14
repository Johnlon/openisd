/** The Bin's marks as sync docs: one small doc per binned project. */
import type {DocId} from '@openisd/design/cloud';
import type {LocalDoc, LocalDocs, LocalRead} from '../localDocs.js';
import {binMarkOf, type ProjectBinMarks} from '../../repos/projectBinMarks.js';
import type {LayoutRules} from '../../repos/layoutMigration.js';

export interface BinMarkDocsDeps {
  readonly marks: ProjectBinMarks;
  readonly rules: LayoutRules;
}

export function createBinMarkDocs(deps: BinMarkDocsDeps): LocalDocs {
  const {marks, rules} = deps;

  function list(): LocalRead {
    const read = marks.read();
    if (read.kind !== 'ok') return {kind: 'unreadable'};
    const docs: LocalDoc[] = read.entries.map(e => ({
      id: {kind: 'projectBin', uuid: e.id},
      body: JSON.stringify({at_ms: e.mark.at_ms, by: e.mark.by, hash: e.mark.hash}),
      layout: rules.layout,
    }));
    return {kind: 'ok', docs};
  }

  function put(doc: LocalDoc): 'done' | 'refused' {
    if (doc.id.kind !== 'projectBin') return 'refused';
    let parsed: unknown;
    try { parsed = JSON.parse(doc.body); } catch { return 'refused'; }
    const mark = binMarkOf(parsed);
    return mark === null ? 'refused' : marks.put(doc.id.uuid, mark);
  }

  function remove(id: DocId): 'done' | 'refused' {
    return id.kind === 'projectBin' ? marks.remove(id.uuid) : 'refused';
  }

  /** A mark reads the same in every layout so far. */
  function migrate(doc: LocalDoc): string | null {
    if (doc.id.kind !== 'projectBin' || doc.layout > rules.layout) return null;
    return doc.body;
  }

  return {
    kind: 'projectBin',
    list,
    put,
    remove,
    migrate,
    // One version of a mark wins (Lamport); a mark is never kept twice.
    putConflictCopy: () => 'refused',
  };
}
