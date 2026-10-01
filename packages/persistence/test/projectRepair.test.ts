/**
 * A stored project with a bad field loads with that field reset instead of being refused, the
 * user is told which fields, and the text as it was is kept first (John, 2026-10-01: repair and
 * recover; never reset unless everything else failed, and only after export).
 * bugs/BUG_20261001_one-bad-field-refuses-a-whole-project.md,
 * bugs/BUG_20261001_session-quarantine-goes-stale.md
 */
import {describe, expect, it, vi} from 'vitest';
import {createProjectRepo, type ProjectRepairReport} from '../src/repos/projectRepo.js';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {OPENISD_OPEN_SESSIONS_KEY, OPENISD_STATE_KEY, OPENISD_BACKUP_KEYS} from '../src/repos/storageKeys.js';
import {ProjectBuilder} from '@openisd/design';
import {createEngine} from '@openisd/design/engine';

const engine = createEngine();

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

describe('projectRepo — repairing loads', () => {
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
