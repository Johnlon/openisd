/**
 * A session record holds several projects. One of them failing to read must not cost the
 * others.
 *
 * It did: `loadOpenProjects()` returned on the first entry the validator refused, so a single
 * bad record looked exactly like an unusable session and every readable project went with it.
 * bugs/BUG_20260926_one-bad-session-entry-discards-the-readable-ones.md
 */
import {describe, expect, it} from 'vitest';
import {createProjectRepo} from '../src/repos/projectRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage, type KeyValueStorage} from '../src/storage/keyValueStorage.js';
import {OPENISD_OPEN_SESSIONS_KEY, OPENISD_QUARANTINE_SESSION_KEY} from '../src/repos/storageKeys.js';
import {OpenISDProject} from '@openisd/design';
import {Engine} from '@openisd/design/engine';

const engine = new Engine();

const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

/** A session record holding `texts` as its entries, keyed a, b, c…, focused on `focusedId`. */
function sessionRecord(texts: readonly string[], focusedId: string | null): string {
  const entries = texts.map((text, i) => ({id: String.fromCharCode(97 + i), text, modified: ''}));
  return JSON.stringify({entries, focusedId});
}

function goodProjectText(name: string): string {
  const project = OpenISDProject.empty(engine);
  project.name.set(name);
  project.save();
  return project.toOwprText();
}

function seeded(record: string): {repo: ReturnType<typeof createProjectRepo>; storage: KeyValueStorage} {
  const storage = createMemoryStorage();
  storage.set(OPENISD_OPEN_SESSIONS_KEY, record);
  return {repo: createProjectRepo(engine, noFiles, storage), storage};
}

describe('loadOpenProjects — one refused entry', () => {
  it('restores the entries that read and names the one that did not', () => {
    const record = sessionRecord([goodProjectText('first'), '{}', goodProjectText('third')], 'c');
    const session = seeded(record).repo.loadOpenProjects();

    expect(Array.isArray(session)).toBe(false);
    if (Array.isArray(session) || session === null) throw new Error('expected a session');
    expect(session.projects.map(p => p.name.value)).toEqual(['first', 'third']);
    expect(session.refused).toHaveLength(1);
  });

  it('keeps the focus on the project the record named, counting only the entries that read', () => {
    const record = sessionRecord([goodProjectText('first'), '{}', goodProjectText('third')], 'c');
    const session = seeded(record).repo.loadOpenProjects();
    if (Array.isArray(session) || session === null) throw new Error('expected a session');
    expect(session.projects[session.focusedIndex].name.value).toBe('third');
  });

  it('reports nothing refused when every entry reads', () => {
    const record = sessionRecord([goodProjectText('first'), goodProjectText('second')], 'b');
    const session = seeded(record).repo.loadOpenProjects();
    if (Array.isArray(session) || session === null) throw new Error('expected a session');
    expect(session.refused).toEqual([]);
    expect(session.projects).toHaveLength(2);
  });

  it('still reports an unusable record as a whole — there is nothing to restore from it', () => {
    expect(seeded('not json at all').repo.loadOpenProjects()).toEqual(['open project session is not valid JSON']);
  });
});

describe('quarantineOpenSession', () => {
  it('copies the record aside so the refused entries survive the next save', () => {
    const record = sessionRecord([goodProjectText('first'), '{}'], 'a');
    const {repo, storage} = seeded(record);
    repo.quarantineOpenSession();
    expect(storage.get(OPENISD_QUARANTINE_SESSION_KEY)).toBe(record);
    expect(storage.get(OPENISD_OPEN_SESSIONS_KEY)).toBe(record);
  });
});
