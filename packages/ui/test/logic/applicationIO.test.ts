import {beforeAll, describe, expect, it, vi} from 'vitest';
import {ref} from 'vue';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {createLogging, type Logging} from '../../src/logging/flash.js';
import {createApplicationIO, type DesignIO} from '../../src/logic/applicationIO.js';
import {DesignFiles} from '../../src/logic/fileImportExport.js';
import {createBackupRepo, createFileOpen, createFileStorage, createMemoryStorage, type FileOpen, type FilePick, createProjectRepo, type FileStorage} from '@openisd/persistence';
import {newProject, openProjects, requireFocusedProject} from '../../src/logic/appState.js';
import {createEngine} from '@openisd/design/engine';
import {ensureSampleProject, SAMPLE_PROJECT_OWPR} from '../fixtures/sampleProject.js';

// SAMPLE_PROJECT_OWPR is read directly (not through readSampleProject()) below, so the
// generated fixture has to exist before that read runs — ensured here, once, the same way
// every other consumer of this generated file ensures it (packages/ui/test/fixtures/sampleProject.ts).
ensureSampleProject();

// Backup export/import is exercised on its own in persistence/test/backupRepo.test.ts — every
// createApplicationIO() call here just needs a BackupRepo to satisfy the dependency, never one
// backed by the SAME storage another test in this file is asserting against.
const backup = createBackupRepo(createMemoryStorage());

beforeAll(() => {
  // shareLink() reads location.{origin,pathname} (the project repo's stateToUrl) and writes to the
  // clipboard/history — none exist in this suite's node environment. Stubbed exactly as
  // urlAppState.test.ts stubs `location`, plus the two calls shareLink() itself makes.
  vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
  vi.stubGlobal('history', { replaceState: () => {} });
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
});

/**
 * bugs/archive/BUG_20260822_wpr_import_leaves_previous_projects_meta_in_state_and_reexports_it.md —
 * the Verification section's round-trip: import a `.wpr` with distinct creator/description/
 * date while a differently-named project is open; `state.project.*` must adopt the FILE's
 * values (name from the filename, per the name↔file rule); a following export must emit the
 * file's own `[ProjectInfo]`, never the pre-import project's.
 *
 * The fixture is a REAL WinISD-written golden (`packages/winisd/test/fixtures/winisd-parity/
 * goldens/sealed-small.wpr` — an independent oracle, not this codebase's own writer), with its
 * empty `Description=` line patched to a probe value so a stale-empty field cannot pass as a
 * synced one.
 */
describe('.wpr import syncs state.project from the file, and export round-trips it', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const GOLDEN_SEALED = join(here, '..', '..', '..', 'design', 'test', 'winisd', 'fixtures', 'winisd-parity', 'goldens', 'sealed-small.wpr');

  it('meta flows file → state.project on import, and state → [ProjectInfo] on export', async () => {
    const wprText = readFileSync(GOLDEN_SEALED, 'utf8')
      .replace(/^Description=$/m, 'Description=probe-description-123456');

    // Node has no FileReader/download DOM; stub the minimum importFile/exportWpr touch.
    const alerts: string[] = [];
    const downloadedBodies: (string | Uint8Array)[] = [];
    vi.stubGlobal('alert', (msg: string) => { alerts.push(msg); });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    vi.stubGlobal('Blob', class {
      constructor(parts: unknown[]) {
        const part = parts[0];
        if (typeof part !== 'string' && !(part instanceof Uint8Array)) {
          throw new Error('exportWpr must download a string or bytes');
        }
        downloadedBodies.push(part);
      }
    });
    vi.stubGlobal('document', {
      createElement: (_tag: string) => ({ href: '', download: '', click: () => {} }),
    });
    vi.stubGlobal('FileReader', class {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      result: ArrayBuffer | null = null;
      // Node's global `File`/`Blob` (available since Node 20) are the real spec classes, so
      // `readAsArrayBuffer` reads them the same way the browser's own FileReader would —
      // through `Blob.arrayBuffer()` — rather than a bespoke fake shape `importFile` would
      // need a cast to accept.
      readAsArrayBuffer(file: File): void {
        void file.arrayBuffer().then(buf => {
          this.result = buf;
          queueMicrotask(() => this.onload?.());
        });
      }
    });
    try {
      const engine = createEngine();
      const repo = createProjectRepo(engine, createFileStorage(), createMemoryStorage(), 'http://localhost');
      const logging = createLogging();
      const io = createApplicationIO({ engine,  logging, fileStorage: createFileStorage(), fileOpen: createFileOpen(), projectRepo: repo, files: new DesignFiles(engine, repo), backup });

      // A DIFFERENT project is open before the import — these exact values must all be gone
      // after. The app starts with NO project (QO121), so this opens the one it then dirties.
      newProject();
      requireFocusedProject().name.set('stale-name-999999');
      requireFocusedProject().description.set('stale-description-999999');
      requireFocusedProject().creator.set('stale-creator-999999');
      requireFocusedProject().created.set('stale-created-999999');

      const fakeFile = new File([new TextEncoder().encode(wprText)], 'imported-design.wpr');
      io.importFile(fakeFile);
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.deepEqual(alerts, [], 'the import must succeed');
      // `projectNameFromFilename` strips only OpenISD's own extensions (.owpr/.json) — a
      // foreign `.wpr` keeps its extension in the derived name.
      assert.equal(requireFocusedProject().name.value, 'imported-design.wpr', 'name comes from the FILE NAME');
      assert.equal(requireFocusedProject().description.value, 'probe-description-123456');
      assert.equal(requireFocusedProject().creator.value, 'winisd_research overnight harness');
      assert.equal(requireFocusedProject().created.value, '20260813');

      io.exportWpr();
      assert.equal(downloadedBodies.length, 1, 'exportWpr must produce exactly one download');
      const exportedBody = downloadedBodies[0];
      if (typeof exportedBody === 'string') throw new Error('exportWpr must download bytes, not a string');
      const exported = new TextDecoder().decode(exportedBody);
      assert.match(exported, /^Description=probe-description-123456$/m);
      assert.match(exported, /^Creator=winisd_research overnight harness$/m);
      assert.match(exported, /^CreateDate=20260813$/m);
      // F4 parity: the golden's box values survive the import→export round trip.
      assert.match(exported, /^BType=0$/m);
      assert.match(exported, /^Vr=0\.02$/m);

      // A filter above WinISD's order 10 is exported as order 10, and the export says so.
      requireFocusedProject().filters.set(
        [{type: 'lowpass', enabled: true, family: 'butterworth', order: 15, fc: 50, Q: 0.707}]);
      requireFocusedProject().save();
      io.exportWpr();
      const clamped = downloadedBodies[1];
      if (clamped === undefined || typeof clamped === 'string') throw new Error('second export must download bytes');
      assert.match(new TextDecoder().decode(clamped), /^filter0params=0;1;10;50;0\.707$/m);
      assert.match(logging.message.value, /lowpass order 15 written as order 10/);
    } finally {
      vi.unstubAllGlobals();
      // beforeAll's own stubs are cleared by unstubAllGlobals too — restore them for any
      // test vitest orders after this one.
      vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
      vi.stubGlobal('history', { replaceState: () => {} });
      vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
    }
  });

  it('an .owpr that is not a project logs the FULL parse error list to the console, before the message (QO152)', async () => {
    const consoleErrors: unknown[][] = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => { consoleErrors.push(args); });
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
    try {
      const engine = createEngine();
      const repo = createProjectRepo(engine, createFileStorage(), createMemoryStorage(), 'http://localhost');
      const logging = createLogging();
      const io = createApplicationIO({ engine,  logging, fileStorage: createFileStorage(), fileOpen: createFileOpen(), projectRepo: repo, files: new DesignFiles(engine, repo), backup });

      // Not a project at all — every required top-level member is missing — so there is nothing a
      // field-level repair can keep (a project with bad fields loads repaired instead; John,
      // 2026-10-01). Two members are named, so a fix that only logs `errors[0]` is caught.
      const fakeFile = new File([new TextEncoder().encode('{}')], 'broken.owpr');
      io.importFile(fakeFile);
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.match(logging.message.value, /^Could not import broken\.owpr: /, 'the malformed file must still tell the user');
      assert.equal(consoleErrors.length, 1, 'the malformed file must log to the console exactly once');
      const [, loggedRaw] = consoleErrors[0];
      if (typeof loggedRaw !== 'string') throw new Error('console.error\'s second argument must be the error text');
      const logged = loggedRaw;
      assert.match(logged, /label/);
      assert.match(logged, /saved/, 'the full error list must name BOTH missing members, not just the first');
    } finally {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
      vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
      vi.stubGlobal('history', { replaceState: () => {} });
      vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
    }
  });

  it('Save commits the project to browser storage without opening a file picker', async () => {
    const storage = createMemoryStorage();
    const fileStorage: FileStorage = {
      save: async () => { throw new Error('toolbar Save must not open a file picker'); },
      saveAs: async () => { throw new Error('toolbar Save must not open a file picker'); },
      openFileName: () => null,
      forget: () => {},
    };
    const engine = createEngine();
    const repo = createProjectRepo(engine, fileStorage, storage, 'http://localhost');
    const io = createApplicationIO({ engine,  logging: createLogging(), fileStorage, fileOpen: createFileOpen(), projectRepo: repo, files: new DesignFiles(engine, repo), backup });

    newProject();
    requireFocusedProject().name.set('Saved from toolbar');
    const saved = await io.saveProject();

    assert.equal(saved, true);
    const restored = repo.loadFromStorage();
    assert.ok(!Array.isArray(restored) && restored);
    assert.equal(restored.name.value, 'Saved from toolbar');
  });

  it('Save all commits every open project with unsaved edits, the unfocused ones too', async () => {
    const storage = createMemoryStorage();
    const fileStorage: FileStorage = {
      save: async () => { throw new Error('Save all must not open a file picker'); },
      saveAs: async () => { throw new Error('Save all must not open a file picker'); },
      openFileName: () => null,
      forget: () => {},
    };
    const engine = createEngine();
    const repo = createProjectRepo(engine, fileStorage, storage, 'http://localhost');
    const io = createApplicationIO({ engine,  logging: createLogging(), fileStorage, fileOpen: createFileOpen(), projectRepo: repo, files: new DesignFiles(engine, repo), backup });

    newProject();
    requireFocusedProject().name.set('First of two');
    newProject();
    requireFocusedProject().name.set('Second of two');
    const dirtyBefore = openProjects().filter(p => p.isModified()).length;
    const saved = await io.saveAllProjects();

    assert.equal(saved, dirtyBefore);
    const storedNames = repo.listStoredProjects().map(l => l.name);
    assert.ok(storedNames.includes('First of two') && storedNames.includes('Second of two'), `both were stored: ${storedNames.join(', ')}`);
    assert.ok(openProjects().every(p => !p.isModified()), 'every open project is clean after Save all');
  });
});

/** BUG_20260929_file-open-dialog-seeded-to-winisd: File > Open uses the system open dialog with
 *  one "OpenISD and WinISD files" filter, and falls back to the shell's file input without it. */
describe('openFromDisk — one named filter, fallback to the file input', () => {
  function ioPicking(pick: FilePick, filters: unknown[]) {
    const fileOpen: FileOpen = { pickFile: async (filter) => { filters.push(filter); return pick; } };
    const engine = createEngine();
    const repo = createProjectRepo(engine, createFileStorage(), createMemoryStorage(), 'http://localhost');
    return createApplicationIO({ engine,  logging: createLogging(), fileStorage: createFileStorage(), fileOpen, projectRepo: repo, files: new DesignFiles(engine, repo), backup });
  }

  it('asks the dialog for all four formats under one filter, and imports the picked file', async () => {
    vi.stubGlobal('FileReader', class {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      result: ArrayBuffer | null = null;
      readAsArrayBuffer(file: File): void {
        void file.arrayBuffer().then(buf => { this.result = buf; queueMicrotask(() => this.onload?.()); });
      }
    });
    const filters: unknown[] = [];
    const fallback = vi.fn();
    const io = ioPicking({ kind: 'picked', file: new File([readFileSync(SAMPLE_PROJECT_OWPR)], 'picked-design.owpr') }, filters);

    await io.openFromDisk(fallback);
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.deepEqual(filters, [{
      description: 'OpenISD and WinISD files',
      accept: {
        'application/x-openisd-project': ['.owpr'],
        'application/x-winisd-project': ['.wpr'],
        'application/x-openisd-driver': ['.owdr'],
        'application/x-winisd-driver': ['.wdr'],
      },
    }]);
    assert.equal(fallback.mock.calls.length, 0);
    assert.equal(requireFocusedProject().name.value, 'picked-design');
    vi.unstubAllGlobals();
    vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
    vi.stubGlobal('history', { replaceState: () => {} });
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
  });

  it('opens the shell\'s file input where the browser has no open dialog', async () => {
    const fallback = vi.fn();
    await ioPicking({ kind: 'unsupported' }, []).openFromDisk(fallback);
    assert.equal(fallback.mock.calls.length, 1);
  });

  it('does nothing when the user cancels the dialog', async () => {
    const fallback = vi.fn();
    await ioPicking({ kind: 'cancelled' }, []).openFromDisk(fallback);
    assert.equal(fallback.mock.calls.length, 0);
  });
});

/** John, 2026-10-05: "when a driver or project has been imported/exported we need a little
 *  message". Every export, Save As and import says what it did, naming the thing and the file. */
describe('every import and export says what it did', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const GOLDEN_SEALED = join(here, '..', '..', '..', 'design', 'test', 'winisd', 'fixtures', 'winisd-parity', 'goldens', 'sealed-small.wpr');

  function stubDom(downloads: { name: string; body: string | Uint8Array }[]): void {
    let pending: string | Uint8Array = '';
    vi.stubGlobal('alert', () => { throw new Error('no import or export may raise an alert'); });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    vi.stubGlobal('Blob', class {
      constructor(parts: unknown[]) {
        const part = parts[0];
        if (typeof part !== 'string' && !(part instanceof Uint8Array)) throw new Error('download a string or bytes');
        pending = part;
      }
    });
    vi.stubGlobal('document', {
      createElement: () => {
        const a = { href: '', download: '', click: () => { downloads.push({ name: a.download, body: pending }); } };
        return a;
      },
    });
    vi.stubGlobal('FileReader', class {
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;
      result: ArrayBuffer | null = null;
      readAsArrayBuffer(file: File): void {
        void file.arrayBuffer().then(buf => { this.result = buf; queueMicrotask(() => this.onload?.()); });
      }
    });
  }

  function restoreGlobals(): void {
    vi.unstubAllGlobals();
    vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
    vi.stubGlobal('history', { replaceState: () => {} });
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
  }

  async function settle(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, 0));
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  function ioWith(fileStorage: FileStorage) {
    const logging: Logging = { message: ref(''), flash: vi.fn() };
    const engine = createEngine();
    const repo = createProjectRepo(engine, fileStorage, createMemoryStorage(), 'http://localhost');
    const io = createApplicationIO({ engine,  logging, fileStorage, fileOpen: createFileOpen(), projectRepo: repo, files: new DesignFiles(engine, repo), backup });
    return { io, flash: logging.flash };
  }

  function fakeFileStorage(result: { name: string | null; cancelled: boolean; written: boolean }): FileStorage {
    return { save: async () => result, saveAs: async () => result, openFileName: () => null, forget: () => {} };
  }

  async function importGolden(io: DesignIO): Promise<void> {
    io.importFile(new File([readFileSync(GOLDEN_SEALED)], 'MyBox.wpr'));
    await settle();
    requireFocusedProject().driver.brand.set('Tang Band');
    requireFocusedProject().driver.model.set('W5-1138SMF');
  }

  it('project import, .wpr export, .wdr and .owdr export, and a driver import each flash', async () => {
    const downloads: { name: string; body: string | Uint8Array }[] = [];
    stubDom(downloads);
    try {
      const { io, flash } = ioWith(createFileStorage());
      await importGolden(io);
      expect(flash).toHaveBeenCalledWith('Project imported from MyBox.wpr');

      io.exportWpr();
      expect(flash).toHaveBeenLastCalledWith('Project exported as Tang_Band_W5-1138SMF.wpr');
      io.exportWdr();
      expect(flash).toHaveBeenLastCalledWith('Driver exported as Tang_Band_W5-1138SMF.wdr');
      io.exportOwdr();
      expect(flash).toHaveBeenLastCalledWith('Driver exported as Tang_Band_W5-1138SMF.owdr');

      const wdr = downloads.find(d => d.name.endsWith('.wdr'));
      if (!wdr) throw new Error('exportWdr must download a .wdr');
      io.importFile(new File([typeof wdr.body === 'string' ? wdr.body : new Uint8Array(wdr.body)], 'probe.wdr'));
      await settle();
      expect(flash).toHaveBeenLastCalledWith('Driver imported from probe.wdr: Tang Band W5-1138SMF');

      io.exportBackup();
      expect(flash).toHaveBeenLastCalledWith(expect.stringMatching(/^Backup downloaded as openisd-backup-\d{4}-\d{2}-\d{2}\.json$/));
    } finally { restoreGlobals(); }
  });

  it('a .wpr export that had to change the design still says it exported', async () => {
    stubDom([]);
    try {
      const { io, flash } = ioWith(createFileStorage());
      await importGolden(io);
      requireFocusedProject().filters.set(
        [{type: 'lowpass', enabled: true, family: 'butterworth', order: 15, fc: 50, Q: 0.707}]);
      requireFocusedProject().save();
      io.exportWpr();
      expect(flash).toHaveBeenLastCalledWith(expect.stringMatching(/^Project exported as Tang_Band_W5-1138SMF\.wpr: .*lowpass order 15 written as order 10/));
    } finally { restoreGlobals(); }
  });

  it('a file that cannot be read flashes why, naming the file', async () => {
    stubDom([]);
    vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const { io, flash } = ioWith(createFileStorage());
      io.importFile(new File([new TextEncoder().encode('{}')], 'broken.owpr'));
      await settle();
      expect(flash).toHaveBeenCalledWith(expect.stringMatching(/^Could not import broken\.owpr: /));
    } finally { vi.restoreAllMocks(); restoreGlobals(); }
  });

  it('Save As names the file written, or says the download is unconfirmed', async () => {
    newProject();
    requireFocusedProject().name.set('MyBox');
    const written = ioWith(fakeFileStorage({ name: 'MyBox.owpr', cancelled: false, written: true }));
    await written.io.saveProjectAs();
    expect(written.flash).toHaveBeenCalledWith('Project saved as MyBox.owpr');

    const downloaded = ioWith(fakeFileStorage({ name: null, cancelled: false, written: false }));
    await downloaded.io.saveProjectAs();
    expect(downloaded.flash).toHaveBeenCalledWith('Project downloaded as MyBox.owpr. It stays marked unsaved.');

    const cancelled = ioWith(fakeFileStorage({ name: null, cancelled: true, written: false }));
    await cancelled.io.saveProjectAs();
    expect(cancelled.flash).not.toHaveBeenCalled();
  });
});
