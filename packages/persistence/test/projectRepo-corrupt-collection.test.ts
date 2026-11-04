/**
 * An unreadable saved-projects list is kept whole, reported, and never replaced by the old
 * single-project keys (T666 / F09; John: repair data never refuse, backup before destructive write).
 */
import {afterEach, describe, expect, it, vi} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import type {FileStorage} from '../src/storage/fileStorage.js';
import {createMemoryStorage} from '../src/storage/keyValueStorage.js';
import {OPENISD_PROJECTS_KEY, OPENISD_STATE_KEY} from '../src/repos/storageKeys.js';
import {isStoredDataFault} from '../src/repos/storedDataFault.js';
import {backupOn, projectRepoOn} from './fixtures/repoOn.js';
import {goodProjectText} from './fixtures/projectTexts.js';

const engine = createEngine();
const noFiles: FileStorage = {
  save: () => { throw new Error('unused'); }, saveAs: () => { throw new Error('unused'); },
  openFileName: () => null, forget: () => { throw new Error('unused'); },
};
const CORRUPT = '{"entries": [ not json';

afterEach(() => { vi.restoreAllMocks(); });

function corrupt() {
  const storage = createMemoryStorage();
  storage.set(OPENISD_PROJECTS_KEY, CORRUPT);
  storage.set('openisd.project', goodProjectText('Legacy'));
  storage.set(OPENISD_STATE_KEY, goodProjectText('Legacy'));
  const faults = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const repo = projectRepoOn(engine, noFiles, storage, 'http://localhost');
  return {storage, repo, faults};
}

describe('an unreadable saved-projects list', () => {
  it('lists nothing instead of resurrecting the single-project keys', () => {
    expect(corrupt().repo.listStoredProjects()).toEqual([]);
  });
  it('keeps its raw text in a pre-repair copy', () => {
    const {storage, repo} = corrupt();
    repo.listStoredProjects();
    const copies = backupOn(storage).preRepairCopies();
    expect(copies.map(c => c.kind)).toEqual(['projects']);
    expect(copies[0].size).toBe(CORRUPT.length);
  });
  it('is reported once as a project store fault', () => {
    const {repo, faults} = corrupt();
    repo.listStoredProjects();
    repo.listStoredProjects();
    const stored = faults.mock.calls.flatMap((call: unknown[]) => call).filter(isStoredDataFault);
    expect(stored.filter(f => f.store === 'project' && /projects/.test(f.message))).toHaveLength(1);
  });
});
