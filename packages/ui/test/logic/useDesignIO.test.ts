/**
 * `bugs/BUG_20260814_sharelink-does-not-cancel-an-active-what-if-before-serialising-the-driver.md`
 *
 * Every I/O action in `useDesignIO.ts` must cancel an active driver what-if before it reads
 * committed state (`ARCHITECTURE.md` §3 "A what-if never leaks into anything persistent") — an
 * uncommitted, unverified overlay must never be left open once the user has generated an
 * artifact from the committed design. `saveProject`/`saveProjectAs`/`exportWdr`/`exportWpr`/
 * `exportOwdr` already do this via `endAnyActiveWhatIfBeforeIO()`; `shareLink()` was the one
 * that did not.
 */
import { describe, it, beforeAll, vi } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createLogging } from '../../src/logging/flash.js';
import { createDesignIO } from '../../src/logic/useDesignIO.js';
import { createFileStorage, createProjectRepo, createMemoryStorage } from '@openisd/persistence';
import { projectSchema } from '../../src/logic/schemaUpgrade.js';
import { requireFocusedProject, state } from '../../src/logic/appState.js';

beforeAll(() => {
  // shareLink() reads location.{origin,pathname} (the project repo's stateToUrl) and writes to the
  // clipboard/history — none exist in this suite's node environment. Stubbed exactly as
  // persist.test.ts stubs `location`, plus the two calls shareLink() itself makes.
  vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
  vi.stubGlobal('history', { replaceState: () => {} });
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
});

describe('shareLink() cancels an active what-if before serialising the driver', () => {
  it('an active what-if is gone after shareLink() returns', async () => {
    const io = createDesignIO({ logging: createLogging(), fileStorage: createFileStorage(), projectRepo: createProjectRepo(createMemoryStorage(), projectSchema, createFileStorage()) });
    requireFocusedProject().beginWhatIf();
    assert.equal(requireFocusedProject().isWhatIfActive(), true, 'precondition: a what-if is open');

    await io.shareLink();

    assert.equal(requireFocusedProject().isWhatIfActive(), false,
      'shareLink() must cancel the what-if itself, like every sibling export/save function');
  });
});

/**
 * bugs/BUG_20260822_wpr_import_leaves_previous_projects_meta_in_state_and_reexports_it.md —
 * the Verification section's round-trip: import a `.wpr` with distinct creator/description/
 * date while a differently-named project is open; `state.project.*` must adopt the FILE's
 * values (name from the filename, per the name↔file rule); a following export must emit the
 * file's own `[ProjectInfo]`, never the pre-import project's.
 *
 * The fixture is a REAL WinISD-written golden (`packages/design/test/winisd/fixtures/winisd-parity/
 * goldens/sealed-small.wpr` — an independent oracle, not this codebase's own writer), with its
 * empty `Description=` line patched to a probe value so a stale-empty field cannot pass as a
 * synced one.
 */
describe('.wpr import syncs state.project from the file, and export round-trips it', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const GOLDEN = join(here, '..', '..', '..', 'winisd', 'test', 'fixtures', 'winisd-parity', 'goldens', 'sealed-small.wpr');

  it('meta flows file → state.project on import, and state → [ProjectInfo] on export', async () => {
    const wprText = readFileSync(GOLDEN, 'utf8')
      .replace(/^Description=$/m, 'Description=probe-description-123456');

    // Node has no FileReader/download DOM; stub the minimum importFile/exportWpr touch.
    const alerts: string[] = [];
    const downloadedBodies: (string | Uint8Array)[] = [];
    vi.stubGlobal('alert', (msg: string) => { alerts.push(msg); });
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    vi.stubGlobal('Blob', class { constructor(parts: unknown[]) { downloadedBodies.push(parts[0] as string | Uint8Array); } });
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
      const io = createDesignIO({ logging: createLogging(), fileStorage: createFileStorage(), projectRepo: createProjectRepo(createMemoryStorage(), projectSchema, createFileStorage()) });

      // A DIFFERENT project is open before the import — these exact values must all be gone after.
      state.project.name = 'stale-name-999999';
      state.project.description = 'stale-description-999999';
      state.project.creator = 'stale-creator-999999';
      state.project.created = 'stale-created-999999';

      const fakeFile = new File([new TextEncoder().encode(wprText)], 'imported-design.wpr');
      io.importFile(fakeFile);
      await new Promise(resolve => setTimeout(resolve, 0));
      await new Promise(resolve => setTimeout(resolve, 0));

      assert.deepEqual(alerts, [], 'the import must succeed');
      // `projectNameFromFilename` strips only OpenISD's own extensions (.owpr/.json) — a
      // foreign `.wpr` keeps its extension in the derived name.
      assert.equal(state.project.name, 'imported-design.wpr', 'name comes from the FILE NAME');
      assert.equal(state.project.description, 'probe-description-123456');
      assert.equal(state.project.creator, 'winisd_research overnight harness');
      assert.equal(state.project.created, '20260813');

      io.exportWpr();
      assert.equal(downloadedBodies.length, 1, 'exportWpr must produce exactly one download');
      const exported = new TextDecoder().decode(downloadedBodies[0] as Uint8Array);
      assert.match(exported, /^Description=probe-description-123456$/m);
      assert.match(exported, /^Creator=winisd_research overnight harness$/m);
      assert.match(exported, /^CreateDate=20260813$/m);
      // F4 parity: the golden's box values survive the import→export round trip.
      assert.match(exported, /^BType=0$/m);
      assert.match(exported, /^Vr=0\.02$/m);
    } finally {
      vi.unstubAllGlobals();
      // beforeAll's own stubs are cleared by unstubAllGlobals too — restore them for any
      // test vitest orders after this one.
      vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
      vi.stubGlobal('history', { replaceState: () => {} });
      vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
    }
  });
});
