/**
 * Projects saved by the build before T036 (box Qiclfr became a required field) still load, and an
 * entry the build refuses stays byte-identical in storage. The fixtures are real: each `.owpr`
 * was written by `OpenISDProject.toOwprText` at 98452289, the commit before T036 landed, and is
 * never edited. A schema change that refuses them fails here, before a user's projects vanish.
 */
import {readdirSync, readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it, vi} from 'vitest';
import {z} from 'zod';
import {createProjectRepo, type ProjectRepairReport} from '../src/repos/projectRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {
  OPENISD_BACKUP_KEYS, OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY,
} from '../src/repos/storageKeys.js';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();
const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'stored-pre-t036');
const fixtures = readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.owpr')).sort()
  .map(f => ({id: f.replace('.owpr', ''), text: readFileSync(join(FIXTURE_DIR, f), 'utf8')}));
const REFUSED = '{}';
const entriesSchema = z.object({entries: z.array(z.object({id: z.string(), text: z.string()}))});
/** The text stored for entry `id` in a stored list or session record. */
function storedText(record: string | null, id: string): string | undefined {
  return entriesSchema.parse(JSON.parse(record ?? '{}')).entries.find(e => e.id === id)?.text;
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function recordAt(v: unknown, key: string): Record<string, unknown> {
  const child = isRecord(v) ? v[key] : undefined;
  if (!isRecord(child)) throw new Error(`no object at '${key}'`);
  return child;
}
const MODIFIED = '2026-10-01T00:00:00Z';

const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

const storedList = (extra: readonly {id: string; text: string}[] = []) => JSON.stringify({
  version: 1,
  entries: [...fixtures, ...extra].map(e => ({id: e.id, text: e.text, modified: MODIFIED})),
});
const sessionRecord = (extra: readonly {id: string; text: string}[] = []) => JSON.stringify({
  entries: [...fixtures, ...extra].map(e => ({id: e.id, text: e.text, modified: MODIFIED, traceHidden: false})),
  focusedId: fixtures[0]!.id,
});

describe('the fixtures are the pre-T036 shape', () => {
  it('there is one per box type', () => {
    expect(fixtures.map(f => f.id)).toEqual(['abc', 'bandpass4', 'bandpass6', 'passiveRadiator', 'sealed', 'vented']);
  });
  it('none carries a box Qiclfr', () => {
    for (const f of fixtures) expect(f.text, f.id).not.toContain('"Qiclfr"');
  });
});

describe('a stored project list from before T036', () => {
  it('lists and loads every project, with no repair notice', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: storedList()});
    const onRepaired = vi.fn<(report: ProjectRepairReport) => void>();
    const repo = createProjectRepo(engine, noFiles, storage, 'http://localhost', onRepaired);
    expect(repo.listStoredProjects().map(p => p.id).sort()).toEqual(fixtures.map(f => f.id));
    for (const f of fixtures) {
      const loaded = repo.loadStoredProject(f.id);
      if (Array.isArray(loaded)) throw new Error(`${f.id} refused: ${loaded.join('; ')}`);
      expect(loaded.name.value).toBe(`pre-T036 ${f.id}`);
    }
    expect(onRepaired).not.toHaveBeenCalled();
  });

  it('a two-chamber project reads its box Qiclfr from the old chamber value', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: storedList()});
    const repo = createProjectRepo(engine, noFiles, storage, 'http://localhost');
    const loaded = repo.loadStoredProject('abc');
    if (Array.isArray(loaded)) throw new Error('refused: ' + loaded.join('; '));
    expect(loaded.box.abc.Qiclfr.value).toBe(100);
  });
});

describe('an open session from before T036', () => {
  it('restores every project and refuses none', () => {
    const storage = createMemoryStorage({[OPENISD_OPEN_SESSIONS_KEY]: sessionRecord()});
    const repo = createProjectRepo(engine, noFiles, storage, 'http://localhost');
    const session = repo.loadOpenProjects();
    if (session === null || Array.isArray(session)) throw new Error('expected a session');
    expect(session.refused).toEqual([]);
    expect(session.projects.map(p => p.name.value).sort()).toEqual(fixtures.map(f => `pre-T036 ${f.id}`).sort());
  });

  it('start-up stores it with a box Qiclfr, after backing up the original text', () => {
    const record = sessionRecord();
    const storage = createMemoryStorage({[OPENISD_OPEN_SESSIONS_KEY]: record});
    createProjectRepo(engine, noFiles, storage, 'http://localhost');
    expect(storage.get(OPENISD_BACKUP_KEYS.openSessions)).toBe(record);
    expect(storage.get(OPENISD_OPEN_SESSIONS_KEY)).toContain('Qiclfr');
  });
});

/** A stored project from before the front Qicl was dropped: only the front chamber has a value. */
function frontOnlyQicl(value: number): string {
  const bandpass4 = fixtures.find(f => f.id === 'bandpass4');
  if (bandpass4 === undefined) throw new Error('no bandpass4 fixture');
  const session: unknown = JSON.parse(bandpass4.text);
  for (const where of ['saved', 'edited']) {
    if (!isRecord(session) || session[where] === null || session[where] === undefined) continue;
    const bp = recordAt(recordAt(session[where], 'box'), 'bandpass4');
    Reflect.deleteProperty(recordAt(recordAt(bp, 'rear'), 'losses'), 'Qicl');
    recordAt(recordAt(bp, 'front'), 'losses').Qicl = value;
  }
  return JSON.stringify(session);
}

describe('a front-only chamber Qicl in storage', () => {
  it('survives start-up as the box Qiclfr, in the stored text and on load', () => {
    const entry = {id: 'front-only', text: frontOnlyQicl(55), modified: MODIFIED};
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: JSON.stringify({version: 1, entries: [entry]})});
    const repo = createProjectRepo(engine, noFiles, storage, 'http://localhost');
    expect(storage.get(OPENISD_PROJECTS_KEY)).not.toContain('"Qicl"');
    const loaded = repo.loadStoredProject('front-only');
    if (Array.isArray(loaded)) throw new Error('refused: ' + loaded.join('; '));
    expect(loaded.box.bandpass4.Qiclfr.value).toBe(55);
  });
});

describe('an entry the build refuses stays byte-identical in storage', () => {
  it('in the project list, through a boot and a save', () => {
    const storage = createMemoryStorage({[OPENISD_PROJECTS_KEY]: storedList([{id: 'refused', text: REFUSED}])});
    const repo = createProjectRepo(engine, noFiles, storage, 'http://localhost');
    const stored = (): string | undefined => storedText(storage.get(OPENISD_PROJECTS_KEY), 'refused');
    expect(stored()).toBe(REFUSED);
    const fresh = ProjectBuilder.empty(engine);
    fresh.name.set('a new design');
    fresh.save();
    repo.saveToStorage(fresh);
    expect(stored()).toBe(REFUSED);
  });

  it('in the open session, copied aside before the next save', () => {
    const record = sessionRecord([{id: 'refused', text: REFUSED}]);
    const storage = createMemoryStorage({[OPENISD_OPEN_SESSIONS_KEY]: record});
    const repo = createProjectRepo(engine, noFiles, storage, 'http://localhost');
    const session = repo.loadOpenProjects();
    if (session === null || Array.isArray(session)) throw new Error('expected a session');
    expect(session.refused).toHaveLength(1);
    repo.quarantineOpenSession();
    repo.saveOpenProjects(session.projects, session.projects[0] ?? null, new Set());
    expect(storedText(storage.get(OPENISD_QUARANTINE_SESSION_KEY), 'refused')).toBe(REFUSED);
  });
});
