/**
 * Which saved projects are in the Bin: one mark per project id, kept apart from the projects. The
 * Bin then syncs as its own small docs, and Restore is a plain delete of a mark.
 */
import type {KeyValueStorage} from '../storage/keyValueStorage.js';
import type {StorageBackup} from './storageBackup.js';
import {OPENISD_PROJECT_BIN_KEY} from './storageKeys.js';

export interface BinMark {
  readonly at_ms: number;
  /** The binning device's name as people see it. */
  readonly by: string;
  /** The project body's hash when it was binned: an edit since then takes it out of the Bin. */
  readonly hash: string;
}

export interface BinMarkEntry {
  readonly id: string;
  readonly mark: BinMark;
}

export type BinMarksRead =
  | {readonly kind: 'ok'; readonly entries: readonly BinMarkEntry[]}
  | {readonly kind: 'unreadable'};

export interface ProjectBinMarks {
  read(): BinMarksRead;
  /** Sets the mark for project `id`, replacing one already held. */
  put(id: string, mark: BinMark): 'done' | 'refused';
  /** Drops the mark for project `id`, after a backup; 'done' when there was none. */
  remove(id: string): 'done' | 'refused';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** `value` as a mark, or null when it is not one. */
export function binMarkOf(value: unknown): BinMark | null {
  if (!isRecord(value)) return null;
  const {at_ms, by, hash} = value;
  if (typeof at_ms !== 'number' || typeof by !== 'string' || typeof hash !== 'string' || hash === '') return null;
  return {at_ms, by, hash};
}

function entryOf(value: unknown): BinMarkEntry | null {
  if (!isRecord(value) || typeof value.id !== 'string' || value.id === '') return null;
  const mark = binMarkOf(value.mark);
  return mark === null ? null : {id: value.id, mark};
}

export function createProjectBinMarks(storage: KeyValueStorage, backup: StorageBackup): ProjectBinMarks {
  function read(): BinMarksRead {
    const text = storage.get(OPENISD_PROJECT_BIN_KEY);
    if (text === null) return {kind: 'ok', entries: []};
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { return {kind: 'unreadable'}; }
    if (!isRecord(parsed) || !Array.isArray(parsed.entries)) return {kind: 'unreadable'};
    const raw: readonly unknown[] = parsed.entries;
    const entries: BinMarkEntry[] = [];
    for (const value of raw) {
      const entry = entryOf(value);
      if (entry === null) return {kind: 'unreadable'};
      entries.push(entry);
    }
    return {kind: 'ok', entries};
  }

  function written(entries: readonly BinMarkEntry[]): boolean {
    return backup.write(OPENISD_PROJECT_BIN_KEY, JSON.stringify({entries}));
  }

  return {
    read,
    put(id, mark) {
      const held = read();
      if (held.kind !== 'ok') return 'refused';
      return written([...held.entries.filter(e => e.id !== id), {id, mark}]) ? 'done' : 'refused';
    },
    remove(id) {
      const held = read();
      if (held.kind !== 'ok') return 'refused';
      if (!held.entries.some(e => e.id === id)) return 'done';
      const guarded = backup.guard(() => written(held.entries.filter(e => e.id !== id)));
      return guarded.kind === 'ran' && guarded.value ? 'done' : 'refused';
    },
  };
}
