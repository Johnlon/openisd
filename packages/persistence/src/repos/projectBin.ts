/**
 * The project Bin: which saved projects are in it, and moving them in and out. A project is in
 * the Bin while it has a mark whose hash is still its body's hash, so an edit made anywhere after
 * it was binned brings it back on every device, with no write needed.
 */
import {bodyHashOf} from '@openisd/design/cloud';
import type {ProjectRepo, StoredProjectListing} from './projectRepo.js';
import type {BinMarkEntry, ProjectBinMarks} from './projectBinMarks.js';
import type {StorageBackup} from './storageBackup.js';

/** One project in the Bin, as the Bin list shows it. */
export interface BinnedProject {
  readonly id: string;
  readonly name: string;
  readonly binnedAt_ms: number;
  /** The device that binned it. */
  readonly device: string;
  /** Its size in browser storage, in bytes. */
  readonly bytes: number;
}

export interface ProjectBin {
  /** The saved projects not in the Bin, as Open project lists them. */
  activeProjects(): StoredProjectListing[];
  /** The projects in the Bin, the most recently binned first. */
  binned(): BinnedProject[];
  isBinned(id: string): boolean;
  /** Bins saved project `id` on this device, then asks for a sync. */
  moveToBin(id: string): 'done' | 'refused';
  /** Takes project `id` out of the Bin, then asks for a sync. */
  restore(id: string): 'done' | 'refused';
  /** Removes project `id` and its mark under one backup; sync then deletes both on Drive. */
  deleteForever(id: string): 'done' | 'refused';
  /** Deletes forever every project in the Bin, under one backup. */
  emptyBin(): 'done' | 'refused';
}

export interface ProjectBinDeps {
  readonly projects: ProjectRepo;
  readonly marks: ProjectBinMarks;
  readonly backup: StorageBackup;
  /** This device's name as people see it. */
  readonly device: () => string;
  readonly now: () => number;
  /** Asks for a sync. */
  readonly onSaved: () => void;
}

const UTF8 = new TextEncoder();

export function createProjectBin(deps: ProjectBinDeps): ProjectBin {
  const {projects, marks} = deps;

  /** Saved project bodies by id. */
  function bodies(): ReadonlyMap<string, string> {
    const docs = projects.storedDocs();
    return new Map(docs.kind === 'ok' ? docs.docs.map(d => [d.id, d.body]) : []);
  }

  /** The marks that still hold: the project is saved here and unchanged since it was binned. */
  function holding(): BinMarkEntry[] {
    const read = marks.read();
    if (read.kind !== 'ok') return [];
    const held = bodies();
    return read.entries.filter(entry => {
      const body = held.get(entry.id);
      return body !== undefined && bodyHashOf(body)?.value === entry.mark.hash;
    });
  }

  function binnedIds(): ReadonlySet<string> {
    return new Set(holding().map(e => e.id));
  }

  /** Drop the copies kept of these project texts when they would not load: deleted forever means
   *  no copy of the project stays in this browser. */
  function discardRefusedOf(texts: ReadonlySet<string>): void {
    for (const copy of deps.backup.refusedCopies()) {
      const text = deps.backup.readRefused(copy.key)?.text;
      if (text !== undefined && texts.has(text)) deps.backup.discardRefused(copy.key);
    }
  }

  function deleteAll(ids: readonly string[]): 'done' | 'refused' {
    if (ids.length === 0) return 'done';
    const held = bodies();
    const texts = new Set(ids.flatMap(id => held.get(id) ?? []));
    const guarded = deps.backup.guard('deleteForever', () => {
      const deleted = ids.every(id => projects.deleteStoredProject(id) === 'done' && marks.remove(id) === 'done');
      if (deleted) discardRefusedOf(texts);
      return deleted;
    });
    if (guarded.kind !== 'ran' || !guarded.value) return 'refused';
    deps.onSaved();
    return 'done';
  }

  return {
    activeProjects() {
      const binned = binnedIds();
      return projects.listStoredProjects().filter(p => !binned.has(p.id));
    },
    binned() {
      const held = bodies();
      const names = new Map(projects.listStoredProjects().map(p => [p.id, p.name]));
      return holding()
        .map(({id, mark}): BinnedProject => ({
          id,
          name: names.get(id) ?? id,
          binnedAt_ms: mark.at_ms,
          device: mark.by,
          bytes: UTF8.encode(held.get(id) ?? '').length,
        }))
        .sort((a, b) => b.binnedAt_ms - a.binnedAt_ms);
    },
    isBinned(id) {
      return binnedIds().has(id);
    },
    moveToBin(id) {
      const body = bodies().get(id);
      const hash = body === undefined ? null : bodyHashOf(body);
      if (hash === null) return 'refused';
      if (marks.put(id, {at_ms: deps.now(), by: deps.device(), hash: hash.value}) !== 'done') return 'refused';
      deps.onSaved();
      return 'done';
    },
    restore(id) {
      if (marks.remove(id) !== 'done') return 'refused';
      deps.onSaved();
      return 'done';
    },
    deleteForever(id) {
      return binnedIds().has(id) ? deleteAll([id]) : 'refused';
    },
    emptyBin() {
      return deleteAll(holding().map(e => e.id));
    },
  };
}
