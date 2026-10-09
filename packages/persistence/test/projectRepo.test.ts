/**
 * projectRepo — the project door every load, save and session read goes through.
 * Repairing loads (bugs/BUG_20261001_one-bad-field-refuses-a-whole-project.md,
 * bugs/BUG_20261001_session-quarantine-goes-stale.md), box type validated at the boundary
 * (bugs/archive/BUG_20260828_stored_box_type_is_cast_not_parsed_so_an_unknown_string_reaches_the_simulation.md),
 * partial session restore (bugs/archive/BUG_20260926_one-bad-session-entry-discards-the-readable-ones.md),
 * and cross-tab hearing (bugs/archive/BUG_20260926_tabs-overwrite-each-others-open-projects.md).
 */
import {describe, expect, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {createProjectRepo, type ProjectRepairReport} from '../src/repos/projectRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage, createSharedMemoryStorage, type KeyValueStorage} from '../src/storage/keyValueStorage.js';
import {
  OPENISD_BACKUP_KEYS, OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_STATE_KEY,
} from '../src/repos/storageKeys.js';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();

/** No file is ever written by these tests; the repo only needs the collaborator to exist. */
const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

/** A saved project named `name` with one field the schema refuses. */
function projectWithABadField(name: string): string {
  const project = ProjectBuilder.empty(engine);
  project.name.set(name);
  project.portVelocityLimit_m_per_s.set(25);
  project.save();
  const text = project.toOwprText();
  const broken = text.replace(/"portVelocityLimit_m_per_s":\s*25/, '"portVelocityLimit_m_per_s": "fast"');
  if (broken === text) throw new Error('fixture did not break the field');
  return broken;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function repo() {
  return createProjectRepo(engine, noFiles, createMemoryStorage());
}

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) =>
  ({ state: 'E' as const, value: read_value, origin: 'scraped', readings: { scraped: { read_value } } });

function driverJson() {
  return {
    brand: scraped('Dayton'), model: scraped('RS225'), manufacturer: scraped('Dayton'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    sku: { value: 'TEST-SKU', grounds: [{ origin: 'manufacturer_datasheet', reading: 'TEST-SKU' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs_hz: spec(30), Qts: spec(0.4), Sd_m2: spec(0.02), Cms_m_per_N: spec(0.0005),
        Mms_kg: spec(0.05), Rms_kg_per_s: spec(2), Xmax_m: spec(0.008),
      },
    },
  };
}

/** A valid record, sealed box, then a payload with `box.boxType` swapped for an arbitrary
 *  string — every OTHER field stays valid, so a refusal can only be about the box type. */
function payloadWithBoxType(boxType: string): unknown {
  const driver = OpenISDDriver.fromConformingRecord(driverJson(), engine);
  if (Array.isArray(driver)) throw new Error('fixture driver record must conform: ' + driver.join('; '));
  const project = new ProjectBuilder(driver, engine).sealed().volume_m3(0.03).build();
  project.save();
  // `readProjectText` validates the session wrapper `{ label, saved, edited }`; the box type
  // lives on `saved`.
  const record: unknown = JSON.parse(JSON.stringify(project.cloneSession()));
  if (!isRecord(record)) throw new Error('expected an object');
  const saved = record.saved;
  if (!isRecord(saved)) throw new Error('expected saved to be an object');
  const box = saved.box;
  if (!isRecord(box)) throw new Error('expected saved.box to be an object');
  box.boxType = boxType;
  return record;
}

/** A session record holding `texts` as its entries, keyed a, b, c…, focused on `focusedId`. */
function sessionRecord(texts: readonly string[], focusedId: string | null): string {
  const entries = texts.map((text, i) => ({id: String.fromCharCode(97 + i), text, modified: ''}));
  return JSON.stringify({entries, focusedId});
}

function goodProjectText(name: string): string {
  const project = ProjectBuilder.empty(engine);
  project.name.set(name);
  project.save();
  return project.toOwprText();
}

function seeded(record: string): {repo: ReturnType<typeof createProjectRepo>; storage: KeyValueStorage} {
  const storage = createMemoryStorage();
  storage.set(OPENISD_OPEN_SESSIONS_KEY, record);
  return {repo: createProjectRepo(engine, noFiles, storage), storage};
}

function project(name: string): OpenISDProject {
  const p = ProjectBuilder.empty(engine);
  p.name.set(name);
  p.save();
  return p;
}

describe('projectRepo', () => {
  describe('repairing loads', () => {
    it('an open project with a bad field is restored, reported and backed up, not refused', () => {
      const record = JSON.stringify({entries: [{id: 'a', text: projectWithABadField('mine'), modified: ''}], focusedId: 'a'});
      const storage = createMemoryStorage({[OPENISD_OPEN_SESSIONS_KEY]: record});
      const onRepaired = vi.fn<(report: ProjectRepairReport) => void>();

      const session = createProjectRepo(engine, noFiles, storage, onRepaired).loadOpenProjects();
      if (Array.isArray(session) || session === null) throw new Error('expected a session');

      expect(session.projects.map(p => p.name.value)).toEqual(['mine']);
      expect(session.refused).toEqual([]);
      expect(session.projects[0].portVelocityLimit_m_per_s.value).toBe(17);
      expect(storage.get(OPENISD_BACKUP_KEYS.openSessions)).toBe(record);
      expect(onRepaired).toHaveBeenCalledWith({
        projectName: 'mine',
        repaired: [['saved', 'box', 'portVelocityLimit_m_per_s']],
        backupKey: OPENISD_BACKUP_KEYS.openSessions,
      });
    });

    it('the autosaved project is repaired the same way', () => {
      const text = projectWithABadField('autosaved');
      const storage = createMemoryStorage({[OPENISD_STATE_KEY]: text});
      const onRepaired = vi.fn<(report: ProjectRepairReport) => void>();

      const project = createProjectRepo(engine, noFiles, storage, onRepaired).loadFromStorage();
      if (project === null || Array.isArray(project)) throw new Error('expected a project');

      expect(project.name.value).toBe('autosaved');
      expect(storage.get(OPENISD_BACKUP_KEYS.state)).toBe(text);
      expect(onRepaired).toHaveBeenCalledTimes(1);
    });

    it('a clean load reports nothing and backs nothing up', () => {
      const project = ProjectBuilder.empty(engine);
      project.save();
      const storage = createMemoryStorage({[OPENISD_STATE_KEY]: project.toOwprText()});
      const onRepaired = vi.fn<(report: ProjectRepairReport) => void>();

      createProjectRepo(engine, noFiles, storage, onRepaired).loadFromStorage();

      expect(onRepaired).not.toHaveBeenCalled();
      expect(storage.get(OPENISD_BACKUP_KEYS.state)).toBeNull();
    });
  });

  // bugs/archive/BUG_20261001_boot-rewrites-open-sessions-and-other-tabs-rebuild.md
  describe('saving the session it just read', () => {
    it('writes nothing, so no other tab rebuilds its projects', () => {
      const shared = createSharedMemoryStorage();
      const otherTab = shared.tab();
      const thisTab = shared.tab();
      const project = ProjectBuilder.empty(engine);
      project.name.set('unchanged');
      project.save();
      createProjectRepo(engine, noFiles, otherTab).saveOpenProjects([project], project, new Set());
      let heard = 0;
      otherTab.watch(OPENISD_OPEN_SESSIONS_KEY, () => { heard++; });

      const repo = createProjectRepo(engine, noFiles, thisTab);
      const session = repo.loadOpenProjects();
      if (session === null || Array.isArray(session)) throw new Error('expected a session');
      repo.saveOpenProjects(session.projects, session.projects[session.focusedIndex] ?? null, session.traceHidden);

      expect(heard).toBe(0);
    });
  });

  describe('a stored box type this build knows is restored', () => {
    it('restores a project stored as "sealed"', () => {
      const result = repo().readProjectText(JSON.stringify(payloadWithBoxType('sealed')));
      assert.ok(!Array.isArray(result), `sealed is a declared box type and must restore, got: ${result}`);
    });
  });

  describe('a stored box type this build does NOT know is refused, not cast', () => {
    for (const boxType of ['banana', '', 'PASSIVE-RADIATOR', 'bandpass8', 'passive-radiator', 'pr']) {
      it(`refuses ${JSON.stringify(boxType)} rather than letting it reach the simulation`, () => {
        const result = repo().readProjectText(JSON.stringify(payloadWithBoxType(boxType)));
        assert.ok(Array.isArray(result),
          `${JSON.stringify(boxType)} names no box type this build declares — restoring it would put `
          + 'an unknown string where every switch expects a declared member, and NaN on a chart');
      });
    }
  });

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

  describe('open projects shared between tabs', () => {
    it('a tab hears another tab save its open projects', () => {
      const store = createSharedMemoryStorage();
      const first = createProjectRepo(engine, noFiles, store.tab());
      const second = createProjectRepo(engine, noFiles, store.tab());
      let heard = 0;
      second.watchOpenProjects(() => { heard++; });

      first.saveOpenProjects([project('111111')], null, new Set());

      expect(heard).toBe(1);
    });

    it('a tab does not hear its own save', () => {
      const store = createSharedMemoryStorage();
      const repo = createProjectRepo(engine, noFiles, store.tab());
      let heard = 0;
      repo.watchOpenProjects(() => { heard++; });

      repo.saveOpenProjects([project('111111')], null, new Set());

      expect(heard).toBe(0);
    });

    it('a tab stops hearing once it unsubscribes', () => {
      const store = createSharedMemoryStorage();
      const first = createProjectRepo(engine, noFiles, store.tab());
      const second = createProjectRepo(engine, noFiles, store.tab());
      let heard = 0;
      const stop = second.watchOpenProjects(() => { heard++; });
      stop();

      first.saveOpenProjects([project('111111')], null, new Set());

      expect(heard).toBe(0);
    });
  });


  describe('browser storage project door', () => {
    it('saves and restores the committed project without view state', () => {
      const repo = createProjectRepo(engine, noFiles, createMemoryStorage());
      repo.saveToStorage(project('Browser storage fixture'));

      const loaded = repo.loadFromStorage();

      assert.ok(!Array.isArray(loaded) && loaded, 'saved project must restore');
      expect(loaded.name.value).toBe('Browser storage fixture');
    });

    it('lists every saved project newest first and loads the selected project', () => {
      const repo = createProjectRepo(engine, noFiles, createMemoryStorage());
      const older = project('Older browser project');
      older.modified.set('2026-01-02');
      older.save();
      const newer = project('Newer browser project');
      newer.modified.set('2026-01-04');
      newer.save();

      repo.saveToStorage(older);
      repo.saveToStorage(newer);

      const listings = repo.listStoredProjects();
      expect(listings.map(entry => entry.name)).toEqual(['Newer browser project', 'Older browser project']);
      const loaded = repo.loadStoredProject(listings[1].id);
      assert.ok(!Array.isArray(loaded) && loaded);
      expect(loaded.name.value).toBe('Older browser project');
    });

    it('saving a project opened from browser storage updates its entry', () => {
      const repo = createProjectRepo(engine, noFiles, createMemoryStorage());
      repo.saveToStorage(project('Stored project to reopen'));
      const reopened = repo.loadStoredProject(repo.listStoredProjects()[0].id);
      assert.ok(!Array.isArray(reopened) && reopened);

      reopened.name.set('Stored project after edit');
      repo.saveToStorage(reopened);

      expect(repo.listStoredProjects().map(entry => entry.name)).toEqual(['Stored project after edit']);
    });

    it('restores every open project and the focused project after refresh', () => {
      const repo = createProjectRepo(engine, noFiles, createMemoryStorage());
      const first = project('Open project one');
      const second = project('Open project two');

      repo.saveOpenProjects([first, second], second, new Set());

      const restored = repo.loadOpenProjects();
      assert.ok(restored && !Array.isArray(restored));
      expect(restored.projects.map(p => p.name.value)).toEqual(['Open project one', 'Open project two']);
      expect(restored.focusedIndex).toBe(1);
    });

    it('closing every project stores an empty session and keeps the project in storage', () => {
      const repo = createProjectRepo(engine, noFiles, createMemoryStorage());
      const only = project('Closed project');
      repo.saveToStorage(only);
      repo.saveOpenProjects([only], only, new Set());

      repo.saveOpenProjects([], null, new Set());

      const restored = repo.loadOpenProjects();
      assert.ok(restored && !Array.isArray(restored));
      expect(restored.projects).toHaveLength(0);
      expect(restored.refused).toHaveLength(0);
      expect(repo.listStoredProjects().map(entry => entry.name)).toEqual(['Closed project']);
    });

    // bugs/BUG_20261005_project-selection-lost-on-reload.md
    it('restores which open projects had their trace hidden after refresh', () => {
      const repo = createProjectRepo(engine, noFiles, createMemoryStorage());
      const first = project('Open project one');
      const second = project('Open project two');

      repo.saveOpenProjects([first, second], second, new Set([first]));

      const restored = repo.loadOpenProjects();
      assert.ok(restored && !Array.isArray(restored));
      expect(restored.projects.map(p => restored.traceHidden.has(p))).toEqual([true, false]);
    });

    it('a trace shown or hidden is written even when no project changed', () => {
      const repo = createProjectRepo(engine, noFiles, createMemoryStorage());
      const only = project('Open project one');
      repo.saveOpenProjects([only], only, new Set());

      repo.saveOpenProjects([only], only, new Set([only]));

      const restored = repo.loadOpenProjects();
      assert.ok(restored && !Array.isArray(restored));
      expect(restored.traceHidden.size).toBe(1);
    });

    it('a session saved before trace visibility was stored restores every trace shown', () => {
      const text = project('Old session project').toOwprText();
      const storage = createMemoryStorage({[OPENISD_OPEN_SESSIONS_KEY]: JSON.stringify({entries: [{id: 'a', text}], focusedId: 'a'})});

      const restored = createProjectRepo(engine, noFiles, storage).loadOpenProjects();

      assert.ok(restored && !Array.isArray(restored));
      expect(restored.projects).toHaveLength(1);
      expect(restored.traceHidden.size).toBe(0);
    });

    it('reads projects saved under the previous browser-storage keys', () => {
      const storage = createMemoryStorage({'openisd.project': project('Legacy saved project').toOwprText()});

      const restored = createProjectRepo(engine, noFiles, storage).loadFromStorage();

      assert.ok(!Array.isArray(restored) && restored);
      expect(restored.name.value).toBe('Legacy saved project');
    });
  });

  describe('stored duplicate project copies (BUG_20261009_stored-project-list-holds-copies)', () => {
    it('a store with the same project 3 times loads as 1 entry and the backup holds all 3', () => {
      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: JSON.stringify({
          version: 1,
          entries: [
            { id: 'id-1', text: goodProjectText('mine'), modified: '2026-01-01T00:00:00Z' },
            { id: 'id-2', text: goodProjectText('mine'), modified: '2026-01-02T00:00:00Z' },
            { id: 'id-3', text: goodProjectText('mine'), modified: '2026-01-03T00:00:00Z' },
          ],
        }),
      });
      const repo = createProjectRepo(engine, noFiles, storage);
      const list = repo.listStoredProjects();
      expect(list).toHaveLength(1);
      expect(list[0].id).toBe('id-3');
      const backupText = storage.get(OPENISD_BACKUP_KEYS.projects);
      assert.ok(backupText !== null, 'backup must be written when copies are merged');
      expect(backupText).toContain('"id":"id-1"');
      expect(backupText).toContain('"id":"id-2"');
      expect(backupText).toContain('"id":"id-3"');
    });

    it('saving twice leaves 1 entry', () => {
      const storage = createMemoryStorage();
      const repo = createProjectRepo(engine, noFiles, storage);
      const p1 = project('twice');
      repo.saveToStorage(p1);
      repo.saveToStorage(p1);
      expect(repo.listStoredProjects().filter(e => e.name === 'twice')).toHaveLength(1);

      // Re-opening the same project from file text and saving again also preserves the 1 entry
      const p2 = OpenISDProject.fromOwprText(p1.toOwprText(), engine);
      assert.ok(!Array.isArray(p2));
      repo.saveToStorage(p2);
      expect(repo.listStoredProjects().filter(e => e.name === 'twice')).toHaveLength(1);
    });
  });
});
