/**
 * `createFileOpen` — the system open dialog. Runs under node: `showOpenFilePicker` is stubbed per
 * test, and absent for the fallback case.
 */
import {afterEach, describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {createFileOpen, type FilePickerFilter} from '@openisd/persistence';

const FILTER: FilePickerFilter = { description: 'OpenISD and WinISD files', accept: { 'application/x-winisd-project': ['.wpr'] } };

afterEach(() => vi.unstubAllGlobals());

describe('createFileOpen().pickFile', () => {
  it('passes the one named filter to the dialog and answers the picked file', async () => {
    const file = new File(['x'], 'a.wpr');
    const calls: unknown[] = [];
    vi.stubGlobal('showOpenFilePicker', async (opts: unknown) => { calls.push(opts); return [{ getFile: async () => file }]; });

    const pick = await createFileOpen().pickFile(FILTER);

    assert.deepEqual(calls, [{ types: [FILTER], multiple: false }]);
    assert.deepEqual(pick, { kind: 'picked', file });
  });

  it('answers cancelled when the user dismisses the dialog', async () => {
    vi.stubGlobal('showOpenFilePicker', async () => { throw new DOMException('dismissed', 'AbortError'); });
    assert.deepEqual(await createFileOpen().pickFile(FILTER), { kind: 'cancelled' });
  });

  it('answers unsupported where the browser has no open dialog API', async () => {
    assert.deepEqual(await createFileOpen().pickFile(FILTER), { kind: 'unsupported' });
  });
});
