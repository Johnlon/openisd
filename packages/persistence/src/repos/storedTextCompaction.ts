/** REPO: rewrites the project texts browser storage holds — the saved projects, the open
 *  session, the autosave and the quarantine copy — as `compactedStoredText` writes them: one
 *  compact line, without `dq_calculated`. A text that is not a project, and an entry that will
 *  not read, stay as they are. Runs behind the whole-store backup and only when a text would
 *  change, so a store already compact is not backed up again. */
import {compactedStoredText} from '@openisd/design';
import type {ListableStorage} from '../storage/keyValueStorage.js';
import type {StorageBackup} from './storageBackup.js';
import {OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_STATE_KEY} from './storageKeys.js';

export type CompactionOutcome =
  | {readonly kind: 'nothingToDo'}
  | {readonly kind: 'rewritten'; readonly charsBefore: number; readonly charsAfter: number}
  /** The backup that must come first does not fit; nothing was written. */
  | {readonly kind: 'refused'};

/** Told, inside the backup, of each saved project whose text was rewritten: its id, its text before
 *  and after. Cloud sync hashes these texts, so it follows the rewrite and sees no edit. */
export type ProjectRewritten = (projectId: string, before: string, after: string) => void;

export interface StoredTextCompaction {
  run(): CompactionOutcome;
}

interface EntryRewrite { readonly id: string; readonly before: string; readonly after: string }
interface Rewrite {
  readonly key: string;
  readonly before: string;
  readonly after: string;
  /** The entries whose text changed, for a key of saved projects. */
  readonly entries: readonly EntryRewrite[];
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A record of `{entries: [{text, ...}], ...}` with each readable entry's text compacted; null
 *  when nothing in it changes or it is not such a record. */
function compactedEntries(record: string): {readonly text: string; readonly entries: readonly EntryRewrite[]} | null {
  let parsed: unknown;
  try { parsed = JSON.parse(record); } catch { return null; }
  if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return null;
  const items: readonly unknown[] = parsed.entries;
  const rewritten: EntryRewrite[] = [];
  const entries = items.map((item): unknown => {
    if (!isRecord(item) || typeof item.text !== 'string') return item;
    const text = compactedStoredText(item.text);
    if (text === null || text === item.text) return item;
    if (typeof item.id === 'string') rewritten.push({id: item.id, before: item.text, after: text});
    return {...item, text};
  });
  return rewritten.length > 0 ? {text: JSON.stringify({...parsed, entries}), entries: rewritten} : null;
}

const ENTRY_RECORD_KEYS: readonly string[] = [OPENISD_PROJECTS_KEY, OPENISD_OPEN_SESSIONS_KEY, OPENISD_QUARANTINE_SESSION_KEY];

export function createStoredTextCompaction(storage: ListableStorage, backup: StorageBackup, projectRewritten: ProjectRewritten): StoredTextCompaction {
  function pending(): Rewrite[] {
    const rewrites: Rewrite[] = [];
    for (const key of ENTRY_RECORD_KEYS) {
      const before = storage.get(key);
      const compacted = before === null ? null : compactedEntries(before);
      if (before !== null && compacted !== null) rewrites.push({key, before, after: compacted.text, entries: compacted.entries});
    }
    const autosave = storage.get(OPENISD_STATE_KEY);
    const compacted = autosave === null ? null : compactedStoredText(autosave);
    if (autosave !== null && compacted !== null && compacted !== autosave) {
      rewrites.push({key: OPENISD_STATE_KEY, before: autosave, after: compacted, entries: []});
    }
    return rewrites;
  }

  return {
    run() {
      const rewrites = pending();
      if (rewrites.length === 0) return {kind: 'nothingToDo'};
      const done = backup.guard('startUpRewrite', () => {
        for (const rewrite of rewrites) {
          storage.set(rewrite.key, rewrite.after);
          if (rewrite.key === OPENISD_PROJECTS_KEY) for (const entry of rewrite.entries) projectRewritten(entry.id, entry.before, entry.after);
        }
      });
      if (done.kind === 'refused') return {kind: 'refused'};
      return {
        kind: 'rewritten',
        charsBefore: rewrites.reduce((n, r) => n + r.before.length, 0),
        charsAfter: rewrites.reduce((n, r) => n + r.after.length, 0),
      };
    },
  };
}
