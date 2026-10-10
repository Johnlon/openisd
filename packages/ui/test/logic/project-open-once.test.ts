/**
 * BUG_20261009_same-project-opens-many-times — a project that is already open is opened ONCE:
 * a second open switches to the tab that is already there, it never adds a second one. Save then
 * writes that one open project in place, so the stored list does not grow a copy per open. The
 * stored project list is ordered by last modified, newest first.
 *
 * Identity (John, 9 Oct 2026): a project is identified by its stored id when it has one, else by
 * the file name and content it was opened from. The identity is recorded AT OPEN TIME and never
 * recomputed from a project that may since have been edited.
 */
import {beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLogging} from '../../src/logging/flash.js';
import {createApplicationIO, type DesignIO} from '../../src/logic/applicationIO.js';
import {DesignFiles} from '../../src/logic/fileImportExport.js';
import {
  createBackupRepo,
  createFileOpen,
  createFileStorage,
  createMemoryStorage,
  createProjectRepo,
  OPENISD_PROJECTS_KEY,
  type ProjectRepo,
} from '@openisd/persistence';
import {engine, focusedProject, newProject, openProjects, removeProject, requireFocusedProject} from '../../src/logic/appState.js';
import {openStoredProject} from '../../src/logic/storedProjectOpen.js';
import {ensureSampleProject, SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';

ensureSampleProject();

beforeAll(() => {
  vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
  vi.stubGlobal('history', { replaceState: () => {} });
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
  // Node has no FileReader; `readDriverFileText` only needs an ArrayBuffer back.
  vi.stubGlobal('FileReader', class {
    onload: null | (() => void) = null;
    onerror: null | (() => void) = null;
    result: ArrayBuffer | null = null;
    readAsArrayBuffer(file: File): void {
      void file.arrayBuffer().then(buf => {
        this.result = buf;
        queueMicrotask(() => this.onload?.());
      });
    }
  });
});

beforeEach(() => {
  while (openProjects().length > 0) removeProject(openProjects().length - 1);
});

function ioOver(storage = createMemoryStorage()): { io: DesignIO; repo: ProjectRepo } {
  const repo = createProjectRepo(engine, createFileStorage(), storage, 'http://localhost');
  const io = createApplicationIO({ engine, 
    logging: createLogging(),
    fileStorage: createFileStorage(),
    fileOpen: createFileOpen(),
    projectRepo: repo,
    files: new DesignFiles(engine, repo),
    backup: createBackupRepo(createMemoryStorage()),
  });
  return { io, repo };
}

/** `importFile` resolves over two microtask hops (FileReader's onload, then the promise chain). */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
}

const FILE_NAME = 'shared.owpr';

describe('a project that is already open is opened once', () => {
  it('a file imported twice leaves one tab, and it stays focused', async () => {
    const { io } = ioOver();
    const content = readFileSync(SAMPLE_PROJECT_OWPR, 'utf8');

    io.importFile(new File([content], FILE_NAME));
    await settle();
    expect(openProjects().length).toBe(1);
    const first = requireFocusedProject();

    io.importFile(new File([content], FILE_NAME));
    await settle();
    expect(openProjects().length).toBe(1);
    expect(focusedProject()).toBe(first);
  });

  it('Save after reopening the same file writes the one project in place', async () => {
    const { io, repo } = ioOver();
    const content = readFileSync(SAMPLE_PROJECT_OWPR, 'utf8');

    io.importFile(new File([content], FILE_NAME));
    await settle();
    await io.saveProject();
    expect(repo.listStoredProjects().length).toBe(1);

    io.importFile(new File([content], FILE_NAME));
    await settle();
    requireFocusedProject().name.set('Renamed once');
    await io.saveProject();

    const stored = repo.listStoredProjects();
    expect(stored.length).toBe(1);
    expect(stored[0]?.name).toBe('Renamed once');
  });

  it('a stored project opened twice leaves one tab, and it stays focused', async () => {
    const { repo } = ioOver();

    newProject();
    requireFocusedProject().name.set('Stored once');
    repo.saveToStorage(requireFocusedProject());
    const id = repo.listStoredProjects()[0]?.id;
    assert.ok(id !== undefined, 'the seeded project must be stored');
    while (openProjects().length > 0) removeProject(openProjects().length - 1);

    const first = openStoredProject(repo, id);
    if (first.kind !== 'opened') throw new Error('the seeded project must open');
    expect(openProjects().length).toBe(1);
    expect(focusedProject()).toBe(first.project);

    const second = openStoredProject(repo, id);
    if (second.kind !== 'opened') throw new Error('the reopened project must open');
    expect(openProjects().length).toBe(1);
    expect(second.project).toBe(first.project);
    expect(focusedProject()).toBe(first.project);
  });
});

describe('the stored project list', () => {
  it('is ordered by last modified, newest first', () => {
    const storage = createMemoryStorage();
    const { repo } = ioOver(storage);
    storage.set(OPENISD_PROJECTS_KEY, JSON.stringify({
      version: 1,
      entries: [
        { id: 'old', text: '{}', modified: '2026-01-01T00:00:00.000Z' },
        { id: 'newest', text: '{}', modified: '2026-03-01T00:00:00.000Z' },
        { id: 'middle', text: '{}', modified: '2026-02-01T00:00:00.000Z' },
      ],
    }));

    expect(repo.listStoredProjects().map(listing => listing.id)).toEqual(['newest', 'middle', 'old']);
  });
});
