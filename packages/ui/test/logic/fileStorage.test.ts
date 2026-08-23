/**
 * `createFileStorage` — the `FileStorage` port (WHERE bytes go/come from, no format knowledge).
 * The port RETAINS the picked handle itself — `save()` takes no handle parameter, and
 * `openFileName()`/`forget()` are how a caller observes/drops it. The retention loop is the
 * substance under test: saveAs retains, save writes through WITHOUT re-prompting, forget
 * makes the next save prompt again.
 *
 * This suite runs under `environment: 'node'` (no real DOM). The File System Access API is
 * stubbed per-test: a fake `showSaveFilePicker` returning a fake handle for the retention
 * tests, absent entirely for the download-fallback tests.
 */
import { describe, it, vi, beforeEach, afterEach } from 'vitest';
import assert from 'node:assert/strict';
import { createFileStorage } from '@openisd/persistence';

/** Exactly the two members `fileStorage.ts`/`fileSave.ts` touch on a picked handle. Declared
 *  here rather than leaning on the DOM lib (which this node-environment suite does not have in
 *  scope), so the fake states what it actually provides rather than claiming a whole
 *  `FileSystemFileHandle` it does not implement. */
interface WritableHandle {
  name: string;
  createWritable(): Promise<{ write(data: string | Uint8Array): Promise<void>; close(): Promise<void> }>;
}

/** A fake picked handle: records every write, counts nothing itself. */
function fakeHandle(name: string, writes: (string | Uint8Array)[]): WritableHandle {
  return {
    name,
    createWritable: async () => ({
      write: async (data: string | Uint8Array) => { writes.push(data); },
      close: async () => {},
    }),
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('createFileStorage — handle retention (File System Access API present)', () => {
  let pickerCalls = 0;
  let writes: (string | Uint8Array)[] = [];

  beforeEach(() => {
    pickerCalls = 0;
    writes = [];
    vi.stubGlobal('showSaveFilePicker', async (opts?: { suggestedName?: string }) => {
      pickerCalls++;
      return fakeHandle(opts?.suggestedName ?? 'unnamed', writes);
    });
  });

  it('saveAs retains the picked handle: openFileName() answers it', async () => {
    const store = createFileStorage();
    const result = await store.saveAs('probe-111111', 'x.owpr', 'application/x-openisd-project', 'OpenISD project', '.owpr');
    assert.equal(result.written, true);
    assert.equal(result.name, 'x.owpr');
    assert.equal(store.openFileName(), 'x.owpr');
    assert.equal(pickerCalls, 1);
  });

  it('save() after saveAs writes through the RETAINED handle without re-prompting', async () => {
    const store = createFileStorage();
    await store.saveAs('probe-222222', 'x.owpr', 'application/x-openisd-project', 'OpenISD project', '.owpr');
    assert.equal(pickerCalls, 1);

    const result = await store.save('probe-333333', 'x.owpr', 'application/x-openisd-project', 'OpenISD project', '.owpr');
    assert.equal(result.written, true);
    assert.equal(result.name, 'x.owpr');
    assert.equal(pickerCalls, 1, 'the second save must NOT open the picker again');
    assert.deepEqual(writes, ['probe-222222', 'probe-333333']);
  });

  it('forget() drops the retained handle: the next save() prompts again', async () => {
    const store = createFileStorage();
    await store.saveAs('probe-444444', 'x.owpr', 'application/x-openisd-project', 'OpenISD project', '.owpr');
    assert.equal(pickerCalls, 1);

    store.forget();
    assert.equal(store.openFileName(), null);

    await store.save('probe-555555', 'y.owpr', 'application/x-openisd-project', 'OpenISD project', '.owpr');
    assert.equal(pickerCalls, 2, 'after forget(), save must prompt like a first save');
  });

  it('save() with nothing retained yet prompts and then retains, so a THIRD save is silent', async () => {
    const store = createFileStorage();
    await store.save('probe-666666', 'z.owpr', 'application/x-openisd-project', 'OpenISD project', '.owpr');
    assert.equal(pickerCalls, 1);
    assert.equal(store.openFileName(), 'z.owpr');

    await store.save('probe-777777', 'z.owpr', 'application/x-openisd-project', 'OpenISD project', '.owpr');
    assert.equal(pickerCalls, 1, 'the handle picked by the first save must be reused');
  });
});

describe('createFileStorage — no File System Access API available', () => {
  let clicked: string[] = [];

  beforeEach(() => {
    clicked = [];
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} });
    vi.stubGlobal('Blob', class { constructor(_parts: unknown[], _opts?: unknown) {} });
    vi.stubGlobal('document', {
      createElement: (_tag: string) => {
        const el = { href: '', download: '', click: () => { clicked.push(el.download); } };
        return el;
      },
    });
  });

  it('saveAs() falls back to a browser download, retains nothing, and reports written:false', async () => {
    const store = createFileStorage();
    const result = await store.saveAs('probe-888888', 'x.owdr', 'application/x-openisd-driver', 'OpenISD driver', '.owdr');
    assert.equal(result.cancelled, false);
    assert.equal(result.written, false);
    assert.equal(result.name, null);
    assert.equal(store.openFileName(), null, 'a download leaves no handle to retain');
    assert.deepEqual(clicked, ['x.owdr']);
  });
});
