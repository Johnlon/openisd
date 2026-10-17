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
import {createProjectRepo, type ProjectRepairReport, storedProjectsPayload} from '../src/repos/projectRepo.js';
import {isStoredDataFault} from '../src/repos/storedDataFault.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage, createSharedMemoryStorage, type ListableStorage} from '../src/storage/keyValueStorage.js';
import {
  OPENISD_BACKUP_KEYS, OPENISD_OPEN_SESSIONS_KEY, OPENISD_PROJECTS_KEY, OPENISD_QUARANTINE_SESSION_KEY, OPENISD_REFUSED_PREFIX, OPENISD_STATE_KEY,
  OPENISD_STORAGE_LAYOUT_KEY,
} from '../src/repos/storageKeys.js';
import {OpenISDDriver, OpenISDProject, ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';
import {backupOn, exportedFilesOn, projectRepoOn} from './fixtures/repoOn.js';
import {goodProjectText, projectWithABadField, projectWithFrontQicl} from './fixtures/projectTexts.js';

const engine = createEngine();

/** No file is ever written by these tests; the repo only needs the collaborator to exist. */
const noFiles: FileStorage = {
  save: () => { throw new Error('no test here writes a file'); },
  saveAs: () => { throw new Error('no test here writes a file'); },
  openFileName: () => null,
  forget: () => { throw new Error('no test here writes a file'); },
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function repo() {
  return projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
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
    driver_type: scraped(['woofer']),
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

function seeded(record: string): {repo: ReturnType<typeof createProjectRepo>; storage: ListableStorage} {
  const storage = createMemoryStorage();
  storage.set(OPENISD_OPEN_SESSIONS_KEY, record);
  return {repo: projectRepoOn(engine, noFiles, storage, 'http://localhost'), storage};
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

      const session = projectRepoOn(engine, noFiles, storage, 'http://localhost', onRepaired).loadOpenProjects();
      if (Array.isArray(session) || session === null) throw new Error('expected a session');

      expect(session.projects.map(p => p.name.value)).toEqual(['mine']);
      expect(session.refused).toEqual([]);
      expect(session.projects[0].portVelocityLimit_m_per_s.value).toBe(17);
      expect(backupOn(storage).readPreRepairCopy('openSessions')).toBe(record);
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

      const project = projectRepoOn(engine, noFiles, storage, 'http://localhost', onRepaired).loadFromStorage();
      if (project === null || Array.isArray(project)) throw new Error('expected a project');

      expect(project.name.value).toBe('autosaved');
      expect(backupOn(storage).readPreRepairCopy('state')).toBe(text);
      expect(onRepaired).toHaveBeenCalledTimes(1);
    });

    it('a clean load reports nothing and backs nothing up', () => {
      const project = ProjectBuilder.empty(engine);
      project.save();
      const storage = createMemoryStorage({[OPENISD_STATE_KEY]: project.toOwprText()});
      const onRepaired = vi.fn<(report: ProjectRepairReport) => void>();

      projectRepoOn(engine, noFiles, storage, 'http://localhost', onRepaired).loadFromStorage();

      expect(onRepaired).not.toHaveBeenCalled();
      expect(backupOn(storage).readPreRepairCopy('state')).toBeNull();
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
      projectRepoOn(engine, noFiles, otherTab, 'http://localhost').saveOpenProjects([project], project, new Set());
      let heard = 0;
      otherTab.watch(OPENISD_OPEN_SESSIONS_KEY, () => { heard++; });

      const repo = projectRepoOn(engine, noFiles, thisTab, 'http://localhost');
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
      expect(session.refusedEntries).toEqual([{id: session.refusedEntries[0].id, text: '{}'}]);
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

  describe('keepRefusedEntries', () => {
    it('keeps each refused entry whole, once however often it is kept, and reports none lost', () => {
      const {repo, storage} = seeded(sessionRecord([goodProjectText('first'), '{"label":"Box B"'], 'a'));
      const session = repo.loadOpenProjects();
      if (Array.isArray(session) || session === null) throw new Error('expected a session');
      expect(repo.keepRefusedEntries(session.refusedEntries)).toBe(0);
      expect(repo.keepRefusedEntries(session.refusedEntries)).toBe(0);
      const kept = storage.keys().filter(key => key.startsWith(OPENISD_REFUSED_PREFIX));
      expect(kept).toHaveLength(1);
      expect(storage.get(kept[0])).toContain('"text":"{\\"label\\":\\"Box B\\""');
    });
  });

  describe('open projects shared between tabs', () => {
    it('a tab hears another tab save its open projects', () => {
      const store = createSharedMemoryStorage();
      const first = projectRepoOn(engine, noFiles, store.tab(), 'http://localhost');
      const second = projectRepoOn(engine, noFiles, store.tab(), 'http://localhost');
      let heard = 0;
      second.watchOpenProjects(() => { heard++; });

      first.saveOpenProjects([project('111111')], null, new Set());

      expect(heard).toBe(1);
    });

    it('a tab does not hear its own save', () => {
      const store = createSharedMemoryStorage();
      const repo = projectRepoOn(engine, noFiles, store.tab(), 'http://localhost');
      let heard = 0;
      repo.watchOpenProjects(() => { heard++; });

      repo.saveOpenProjects([project('111111')], null, new Set());

      expect(heard).toBe(0);
    });

    it('a tab stops hearing once it unsubscribes', () => {
      const store = createSharedMemoryStorage();
      const first = projectRepoOn(engine, noFiles, store.tab(), 'http://localhost');
      const second = projectRepoOn(engine, noFiles, store.tab(), 'http://localhost');
      let heard = 0;
      const stop = second.watchOpenProjects(() => { heard++; });
      stop();

      first.saveOpenProjects([project('111111')], null, new Set());

      expect(heard).toBe(0);
    });
  });


  describe('browser storage project door', () => {
    it('saves and restores the committed project without view state', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      repo.saveToStorage(project('Browser storage fixture'));

      const loaded = repo.loadFromStorage();

      assert.ok(!Array.isArray(loaded) && loaded, 'saved project must restore');
      expect(loaded.name.value).toBe('Browser storage fixture');
    });

    it('lists every saved project newest first and loads the selected project', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
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
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      repo.saveToStorage(project('Stored project to reopen'));
      const reopened = repo.loadStoredProject(repo.listStoredProjects()[0].id);
      assert.ok(!Array.isArray(reopened) && reopened);

      reopened.name.set('Stored project after edit');
      repo.saveToStorage(reopened);

      expect(repo.listStoredProjects().map(entry => entry.name)).toEqual(['Stored project after edit']);
    });

    it('restores every open project and the focused project after refresh', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const first = project('Open project one');
      const second = project('Open project two');

      repo.saveOpenProjects([first, second], second, new Set());

      const restored = repo.loadOpenProjects();
      assert.ok(restored && !Array.isArray(restored));
      expect(restored.projects.map(p => p.name.value)).toEqual(['Open project one', 'Open project two']);
      expect(restored.focusedIndex).toBe(1);
    });

    it('closing every project stores an empty session and keeps the project in storage', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
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
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const first = project('Open project one');
      const second = project('Open project two');

      repo.saveOpenProjects([first, second], second, new Set([first]));

      const restored = repo.loadOpenProjects();
      assert.ok(restored && !Array.isArray(restored));
      expect(restored.projects.map(p => restored.traceHidden.has(p))).toEqual([true, false]);
    });

    it('a trace shown or hidden is written even when no project changed', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
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

      const restored = projectRepoOn(engine, noFiles, storage, 'http://localhost').loadOpenProjects();

      assert.ok(restored && !Array.isArray(restored));
      expect(restored.projects).toHaveLength(1);
      expect(restored.traceHidden.size).toBe(0);
    });

    it('reads projects saved under the previous browser-storage keys', () => {
      const storage = createMemoryStorage({'openisd.project': project('Legacy saved project').toOwprText()});

      const restored = projectRepoOn(engine, noFiles, storage, 'http://localhost').loadFromStorage();

      assert.ok(!Array.isArray(restored) && restored);
      expect(restored.name.value).toBe('Legacy saved project');
    });
  });

  describe('stored projects that share a name (BUG_20261009_stored-project-list-holds-copies, ruled 17 Oct 2026)', () => {
    it('are all kept at start-up: the user named them, the store never merges or drops one', () => {
      const entries = ['id-1', 'id-2', 'id-3'].map((id, n) => ({ id, text: goodProjectText('mine'), modified: `2026-01-0${n + 1}T00:00:00Z` }));
      const storage = createMemoryStorage({ [OPENISD_PROJECTS_KEY]: JSON.stringify({ version: 1, entries }) });
      const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      expect(repo.listStoredProjects().map(e => e.id).sort()).toEqual(['id-1', 'id-2', 'id-3']);
    });

    it('saving twice leaves 1 entry', () => {
      const storage = createMemoryStorage();
      const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      const p1 = project('twice');
      repo.saveToStorage(p1);
      repo.saveToStorage(p1);
      expect(repo.listStoredProjects().filter(e => e.name === 'twice')).toHaveLength(1);

    });
  });

  describe('two different projects with one name (BUG_20261017_same-name-projects-show-as-one-row)', () => {
    it('both are stored as their own, both keep the name, and neither changes the other', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const first = project('ABC');
      const second = project('ABC');
      repo.saveToStorage(first);
      repo.saveToStorage(second);
      expect(repo.storedIdOf(second)).not.toBe(repo.storedIdOf(first));
      expect(repo.listStoredProjects().map(e => e.name)).toEqual(['ABC', 'ABC']);
      expect(second.name.value).toBe('ABC');
    });
  });

  describe('storeNew: a project is stored the moment it is made', () => {
    it('stores a project that has no stored copy, unchanged, and says it is stored', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const made = project('Fresh');
      expect(repo.isStored(made, [made])).toBe(false);
      expect(repo.storeNew(made, [made]).kind).toBe('saved');
      expect(repo.isStored(made, [made])).toBe(true);
      expect(made.isModified()).toBe(false);
      expect(repo.listStoredProjects().map(e => e.name)).toEqual(['Fresh']);
    });

    it('a second project of the same name is stored beside the first, keeps its name, and is not shown as changed', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const first = project('ABC');
      const second = project('ABC');
      repo.storeNew(first, [first, second]);
      repo.storeNew(second, [first, second]);
      expect(repo.listStoredProjects().map(e => e.name)).toEqual(['ABC', 'ABC']);
      expect(second.name.value).toBe('ABC');
      expect(second.isModified()).toBe(false);
    });

    it('the same file with the same content is the project already stored: it keeps that copy', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const first = project('ABC');
      repo.storeNew(first, [first]);
      const again = OpenISDProject.fromOwprText(first.toOwprText(), engine);
      assert.ok(!Array.isArray(again));
      repo.storeNew(again, [again]);
      expect(repo.listStoredProjects()).toHaveLength(1);
      expect(repo.storedIdOf(again)).toBe(repo.storedIdOf(first));
    });

    it('a project that already has a stored copy is stored under it again, not beside it', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const made = project('Once');
      repo.storeNew(made, [made]);
      repo.storeNew(made, [made]);
      expect(repo.listStoredProjects()).toHaveLength(1);
    });

    it('an open project that shares its stored copy with an earlier one is stored as its own', () => {
      const repo = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const first = project('ABC');
      const second = project('ABC');
      repo.saveToStorageAs(first, 'one');
      repo.saveToStorageAs(second, 'one');
      expect(repo.isStored(first, [first, second])).toBe(true);
      expect(repo.isStored(second, [first, second])).toBe(false);
      repo.storeNew(second, [first, second]);
      expect(repo.storedIdOf(second)).not.toBe('one');
      expect(repo.listStoredProjects().map(e => e.name)).toEqual(['ABC', 'ABC']);
    });

    it('says it failed when the store takes no more, and the project is not stored', () => {
      const storage = createMemoryStorage();
      const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      const made = project('Big');
      const refuse = vi.spyOn(storage, 'set').mockImplementation(() => { throw new Error('quota'); });
      expect(repo.storeNew(made, [made]).kind).toBe('failed');
      refuse.mockRestore();
      expect(repo.isStored(made, [made])).toBe(false);
    });
  });

  describe('retired field migration (BUG_20261009_retired-field-reset-notice-on-every-load)', () => {
    it('a stored project with front.losses.Qicl loads with no notice and is stored without it; a second load shows nothing', () => {
      const legacy = projectWithFrontQicl('bp4');
      expect(legacy).toContain('"Qicl": 77');

      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: JSON.stringify({
          version: 1,
          entries: [{ id: 'p-1', text: legacy, modified: '2026-01-01T00:00:00Z' }],
        }),
      });

      const onRepaired = vi.fn<(report: ProjectRepairReport) => void>();
      const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost', onRepaired);

      // First load: loads with no notice
      const loaded = repo.loadStoredProject('p-1');
      assert.ok(!Array.isArray(loaded) && loaded);
      expect(loaded.name.value).toBe('bp4');
      expect(onRepaired).not.toHaveBeenCalled();

      // And is stored without it:
      const storedAfter = storage.get(OPENISD_PROJECTS_KEY);
      assert.ok(storedAfter !== null);
      expect(storedAfter).not.toContain('"Qicl": 77');

      // A second load shows nothing
      const loadedAgain = repo.loadStoredProject('p-1');
      assert.ok(!Array.isArray(loadedAgain) && loadedAgain);
      expect(onRepaired).not.toHaveBeenCalled();
    });

    it('at start-up open sessions and backups are migrated and written back (backup updated first)', () => {
      const legacy = projectWithFrontQicl('bp4');
      const storage = createMemoryStorage({
        [OPENISD_OPEN_SESSIONS_KEY]: JSON.stringify({
          entries: [{ id: 's-1', text: legacy, modified: '', traceHidden: false }],
          focusedId: 's-1',
        }),
      });
      projectRepoOn(engine, noFiles, storage, 'http://localhost');
      const sessionStored = storage.get(OPENISD_OPEN_SESSIONS_KEY);
      assert.ok(sessionStored !== null);
      expect(sessionStored).not.toContain('"Qicl": 77');
      const backupSession = backupOn(storage).readPreRepairCopy('openSessions');
      assert.ok(backupSession !== null);
      expect(backupSession).toContain('"id":"s-1"');
    });

    it('listStoredProjects does not notify onRepaired for projects with repaired fields', () => {
      const brokenText = projectWithABadField('test-repair');

      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: JSON.stringify({
          version: 1,
          entries: [{ id: 'p-broken', text: brokenText, modified: '2026-01-01T00:00:00Z' }],
        }),
      });

      const onRepaired = vi.fn<(report: ProjectRepairReport) => void>();
      const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost', onRepaired);

      const listing = repo.listStoredProjects();
      expect(listing).toHaveLength(1);
      expect(listing[0].name).toBe('test-repair');
      expect(onRepaired).not.toHaveBeenCalled();
    });

    it('a store with the same project 3 times AND front.losses.Qicl: after start-up the backup holds all 3 original copies (with Qicl), the store holds 1 entry without Qicl; a second start-up changes nothing (backup unchanged)', () => {
      const qiclProject = projectWithFrontQicl('mine');
      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: JSON.stringify({
          version: 1,
          entries: [
            { id: 'id-1', text: qiclProject, modified: '2026-01-01T00:00:00Z' },
            { id: 'id-2', text: qiclProject, modified: '2026-01-02T00:00:00Z' },
            { id: 'id-3', text: qiclProject, modified: '2026-01-03T00:00:00Z' },
          ],
        }),
      });

      // Start-up 1
      projectRepoOn(engine, noFiles, storage, 'http://localhost');

      const backupText = backupOn(storage).readPreRepairCopy('projects');
      assert.ok(backupText !== null, 'backup must be present after repair');
      expect(backupText).toContain('"id":"id-1"');
      expect(backupText).toContain('"id":"id-2"');
      expect(backupText).toContain('"id":"id-3"');
      expect(backupText).toContain('Qicl');

      const parsedBackupRaw: unknown = JSON.parse(backupText);
      const parsedBackup = storedProjectsPayload(parsedBackupRaw);
      assert.ok(parsedBackup !== null, 'backup must be valid stored projects payload');
      expect(parsedBackup.entries).toHaveLength(3);
      expect(parsedBackup.entries[0].text).toContain('"Qicl": 77');
      expect(parsedBackup.entries[1].text).toContain('"Qicl": 77');
      expect(parsedBackup.entries[2].text).toContain('"Qicl": 77');

      const storeText = storage.get(OPENISD_PROJECTS_KEY);
      assert.ok(storeText !== null);
      expect(storeText).not.toContain('"Qicl"');
      const parsedStoreRaw: unknown = JSON.parse(storeText);
      const parsedStore = storedProjectsPayload(parsedStoreRaw);
      assert.ok(parsedStore !== null, 'store must be valid stored projects payload');
      expect(parsedStore.entries.map(e => e.id)).toEqual(['id-1', 'id-2', 'id-3']);

      // Start-up 2
      projectRepoOn(engine, noFiles, storage, 'http://localhost');

      const backupText2 = backupOn(storage).readPreRepairCopy('projects');
      expect(backupText2).toBe(backupText);
      const storeText2 = storage.get(OPENISD_PROJECTS_KEY);
      expect(storeText2).toBe(storeText);
    });

    it('non-JSON stored projects text is left untouched and records a fault', () => {
      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: 'this is not valid json',
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      projectRepoOn(engine, noFiles, storage, 'http://localhost');
      expect(storage.get(OPENISD_PROJECTS_KEY)).toBe('this is not valid json');
      expect(errorSpy).toHaveBeenCalled();
      const calledWith: unknown = errorSpy.mock.calls[0][0];
      assert.ok(isStoredDataFault(calledWith));
      expect(calledWith.store).toBe('project');
      errorSpy.mockRestore();
    });
  });

  describe('save failure', () => {
    it('returns a failed result when storage throws', () => {
      const storage = createMemoryStorage();
      storage.set = () => { throw new Error('Quota full'); };
      const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      
      const p = ProjectBuilder.empty(engine);
      p.name.set('Test Project');
      p.save();
      
      const result = repo.saveToStorage(p);
      expect(result.kind).toBe('failed');
      if (result.kind === 'failed') {
        expect(result.reason).toContain('Quota full');
      }
    });
  });

  describe('stored docs (cloud sync support)', () => {
    it('storedDocs returns empty list when store is empty', () => {
      const storage = createMemoryStorage();
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      expect(r.storedDocs()).toEqual({ kind: 'ok', docs: [] });
    });

    it('storedDocs lists stored projects with id, body, and layout', () => {
      const text = goodProjectText('My Project');
      const storage = createMemoryStorage({
        [OPENISD_STORAGE_LAYOUT_KEY]: '1',
        [OPENISD_PROJECTS_KEY]: JSON.stringify({
          version: 1,
          entries: [{ id: 'p-1', text, modified: '2026-01-01T00:00:00Z' }],
        }),
      });
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      const res = r.storedDocs();
      expect(res.kind).toBe('ok');
      if (res.kind !== 'ok') return;
      expect(res.docs).toHaveLength(1);
      expect(res.docs[0].id).toBe('p-1');
      expect(res.docs[0].body).toBe(text);
      expect(res.docs[0].layout).toBe(1);
    });

    it('storedDocs returns unreadable on corrupt store', () => {
      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: 'not-json',
      });
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      expect(r.storedDocs()).toEqual({ kind: 'unreadable' });
      errorSpy.mockRestore();
    });

    it('putStoredDoc adds a new project doc by id', () => {
      const storage = createMemoryStorage();
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      const text = goodProjectText('Fresh');
      const res = r.putStoredDoc('p-new', text);
      expect(res).toBe('done');
      const docsRes = r.storedDocs();
      expect(docsRes.kind).toBe('ok');
      if (docsRes.kind !== 'ok') return;
      expect(docsRes.docs).toHaveLength(1);
      expect(docsRes.docs[0].id).toBe('p-new');
    });

    it('putStoredDoc replaces an existing project in place and guards write with backup', () => {
      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: JSON.stringify({
          version: 1,
          entries: [{ id: 'p-1', text: goodProjectText('Old'), modified: '2026-01-01T00:00:00Z' }],
        }),
      });
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      const res = r.putStoredDoc('p-1', goodProjectText('Updated'));
      expect(res).toBe('done');
      const docsRes = r.storedDocs();
      expect(docsRes.kind).toBe('ok');
      if (docsRes.kind !== 'ok') return;
      expect(docsRes.docs).toHaveLength(1);
      expect(docsRes.docs[0].body).toContain('Updated');

      const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
      expect(hasBackup).toBe(true);
    });

    it('putStoredDoc renames incoming project with uniqueName on name collision with a different project', () => {
      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: JSON.stringify({
          version: 1,
          entries: [{ id: 'p-1', text: goodProjectText('SameName'), modified: '2026-01-01T00:00:00Z' }],
        }),
      });
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      const res = r.putStoredDoc('p-2', goodProjectText('SameName'));
      expect(res).toBe('done');
      const docsRes = r.storedDocs();
      expect(docsRes.kind).toBe('ok');
      if (docsRes.kind !== 'ok') return;
      expect(docsRes.docs).toHaveLength(2);
      const secondDoc = docsRes.docs.find(d => d.id === 'p-2');
      expect(secondDoc?.body).toContain('SameName (2)');
    });

    it('removeStoredDoc removes an existing project through backup guard', () => {
      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: JSON.stringify({
          version: 1,
          entries: [{ id: 'p-1', text: goodProjectText('Mine'), modified: '2026-01-01T00:00:00Z' }],
        }),
      });
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      const res = r.removeStoredDoc('p-1');
      expect(res).toBe('done');
      const docsRes = r.storedDocs();
      expect(docsRes.kind).toBe('ok');
      if (docsRes.kind !== 'ok') return;
      expect(docsRes.docs).toHaveLength(0);

      const hasBackup = storage.keys().some(k => k.startsWith('openisd_backup_'));
      expect(hasBackup).toBe(true);
    });

    it('deleteStoredProject removes it from the list, the open session and the refused session, under one backup, and asks for a sync', () => {
      const entry = (id: string, name: string) => ({ id, text: goodProjectText(name), modified: '2026-01-01T00:00:00Z' });
      const sessionOf = (...ids: string[]) => JSON.stringify({
        entries: ids.map(id => ({ ...entry(id, id), traceHidden: false })), focusedId: ids[0] ?? null,
      });
      const storage = createMemoryStorage({
        [OPENISD_PROJECTS_KEY]: JSON.stringify({ version: 1, entries: [entry('p-1', 'Gone'), entry('p-2', 'Kept')] }),
        [OPENISD_OPEN_SESSIONS_KEY]: sessionOf('p-1', 'p-2'),
        [OPENISD_QUARANTINE_SESSION_KEY]: sessionOf('p-1', 'p-3'),
      });
      let saves = 0;
      const r = createProjectRepo(engine, noFiles, storage, 'http://localhost', backupOn(storage), exportedFilesOn(), () => undefined, () => { saves++; });
      expect(r.deleteStoredProject('p-1')).toBe('done');
      expect(r.listStoredProjects().map(p => p.id)).toEqual(['p-2']);
      const ids = (key: string): unknown => {
        const parsed: unknown = JSON.parse(storage.get(key) ?? 'null');
        assert.ok(isRecord(parsed) && Array.isArray(parsed.entries));
        return parsed.entries.map((e: unknown) => (isRecord(e) ? e.id : null));
      };
      expect(ids(OPENISD_OPEN_SESSIONS_KEY)).toEqual(['p-2']);
      expect(ids(OPENISD_QUARANTINE_SESSION_KEY)).toEqual(['p-3']);
      expect(storage.keys().filter(k => k.startsWith('openisd_backup_'))).toHaveLength(1);
      expect(saves).toBe(1);
    });

    it('deleting the last saved project leaves the list empty; the last-saved copy does not bring it back', () => {
      const storage = createMemoryStorage();
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      expect(r.saveToStorage(project('Only')).kind).toBe('saved');
      const [only] = r.listStoredProjects();
      assert.ok(only);
      expect(r.deleteStoredProject(only.id)).toBe('done');
      expect(r.listStoredProjects()).toEqual([]);
      expect(storage.get(OPENISD_STATE_KEY)).toBeNull();
    });

    it('storedIdOf names the saved-list id of a project it saved, and null for one it never saw', () => {
      const r = projectRepoOn(engine, noFiles, createMemoryStorage(), 'http://localhost');
      const saved = project('Saved');
      r.saveToStorage(saved);
      expect(r.storedIdOf(saved)).toBe(r.listStoredProjects()[0]?.id);
      expect(r.storedIdOf(project('Other'))).toBeNull();
    });

    it('deleteStoredProject refuses an id that is not stored, and writes nothing', () => {
      const storage = createMemoryStorage();
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      expect(r.deleteStoredProject('nope')).toBe('refused');
      expect(storage.keys()).toEqual([]);
    });

    it('removeStoredDoc returns refused for absent id', () => {
      const storage = createMemoryStorage();
      const r = projectRepoOn(engine, noFiles, storage, 'http://localhost');
      expect(r.removeStoredDoc('non-existent')).toBe('refused');
    });
  });

  describe('cloud sync onSaved trigger', () => {
    it('notifies onSaved when saving a project to the saved-projects list', () => {
      const storage = createMemoryStorage();
      let savedCount = 0;
      const repo = createProjectRepo(
        engine, noFiles, storage, 'http://localhost', backupOn(storage), exportedFilesOn(),
        () => undefined,
        () => { savedCount++; },
      );
      repo.saveToStorage(project('My Saved Project'));
      assert.equal(savedCount, 1);
    });

    it('does not notify onSaved when cloud doc putStoredDoc or removeStoredDoc is called', () => {
      const storage = createMemoryStorage();
      let savedCount = 0;
      const repo = createProjectRepo(
        engine, noFiles, storage, 'http://localhost', backupOn(storage), exportedFilesOn(),
        () => undefined,
        () => { savedCount++; },
      );
      const docBody = project('Synced Project').toOwprText();
      repo.putStoredDoc('proj-1', docBody);
      assert.equal(savedCount, 0);

      repo.removeStoredDoc('proj-1');
      assert.equal(savedCount, 0);
    });

    it('does not notify onSaved on autosave of the open session', () => {
      const storage = createMemoryStorage();
      let savedCount = 0;
      const repo = createProjectRepo(
        engine, noFiles, storage, 'http://localhost', backupOn(storage), exportedFilesOn(),
        () => undefined,
        () => { savedCount++; },
      );
      const p = project('Session Project');
      repo.saveOpenProjects([p], p, new Set());
      assert.equal(savedCount, 0);
    });
  });
});


