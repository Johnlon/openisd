/**
 * Filesystem save (File System Access API + download fallback).
 *
 * Save/Save As must write the OpenISD project to a file THE USER chose on disk — not
 * localStorage (which is per-browser, quota-limited, wiped by a cache clear). Chromium
 * supports `showSaveFilePicker` (real Save-in-place via a retained handle); Firefox/Safari
 * don't, so they fall back to a plain download. Both paths are exercised here without a
 * real browser: `showSaveFilePicker` is stubbed on `globalThis`, and the download fallback
 * is verified via a spy on persist.ts's `download()`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as persist from '../src/utils/persist.js';
import { fileSystemAccessSupported, saveProjectAs, saveProject } from '../src/utils/fileSave.js';

const TEXT = '{"v":2}';
const NAME = 'design.openisd.json';

function fakeHandle(overrides: Partial<{ write: () => Promise<void> }> = {}) {
  const written: string[] = [];
  const closed = { value: false };
  return {
    written, closed,
    createWritable: vi.fn(async () => ({
      write: overrides.write ?? (async (t: string) => { written.push(t); }),
      close: async () => { closed.value = true; },
    })),
  };
}

describe('fileSystemAccessSupported', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('is false when showSaveFilePicker is not on globalThis', () => {
    vi.stubGlobal('showSaveFilePicker', undefined);
    expect(fileSystemAccessSupported()).toBe(false);
  });

  it('is true when showSaveFilePicker exists', () => {
    vi.stubGlobal('showSaveFilePicker', async () => ({}));
    expect(fileSystemAccessSupported()).toBe(true);
  });
});

describe('saveProjectAs — unsupported browser (Firefox/Safari)', () => {
  beforeEach(() => { vi.stubGlobal('showSaveFilePicker', undefined); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('falls back to a plain download and returns no handle', async () => {
    const spy = vi.spyOn(persist, 'download').mockImplementation(() => {});
    const result = await saveProjectAs(TEXT, NAME);
    expect(spy).toHaveBeenCalledWith(NAME, TEXT, 'application/json');
    expect(result).toEqual({ handle: null, cancelled: false });
  });
});

describe('saveProjectAs — File System Access API supported', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('prompts the picker, writes the text, and returns the retained handle', async () => {
    const handle = fakeHandle();
    const picker = vi.fn(async () => handle);
    vi.stubGlobal('showSaveFilePicker', picker);
    const spy = vi.spyOn(persist, 'download');

    const result = await saveProjectAs(TEXT, NAME);

    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: NAME }));
    expect(handle.createWritable).toHaveBeenCalled();
    expect(handle.written).toEqual([TEXT]);
    expect(handle.closed.value).toBe(true);
    expect(result).toEqual({ handle, cancelled: false });
    expect(spy).not.toHaveBeenCalled(); // no download fallback when the picker succeeds
  });

  it('returns cancelled:true (no error, no download) when the user dismisses the picker', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => { throw abort; }));
    const spy = vi.spyOn(persist, 'download');

    const result = await saveProjectAs(TEXT, NAME);

    expect(result).toEqual({ handle: null, cancelled: true });
    expect(spy).not.toHaveBeenCalled(); // a cancel is not "unsupported" — must not fall back
  });

  it('rethrows a non-cancel picker error', async () => {
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => { throw new Error('disk full'); }));
    await expect(saveProjectAs(TEXT, NAME)).rejects.toThrow('disk full');
  });
});

describe('saveProject — Save (in-place) vs first-time Save As delegation', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('with no existing handle, behaves exactly like Save As', async () => {
    const handle = fakeHandle();
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => handle));

    const result = await saveProject(TEXT, NAME, null);

    expect(handle.written).toEqual([TEXT]);
    expect(result).toEqual({ handle, cancelled: false });
  });

  it('with an existing handle, writes directly and never opens the picker', async () => {
    const handle = fakeHandle();
    const picker = vi.fn();
    vi.stubGlobal('showSaveFilePicker', picker);

    const result = await saveProject(TEXT, NAME, handle as unknown as Parameters<typeof saveProject>[2]);

    expect(picker).not.toHaveBeenCalled();
    expect(handle.written).toEqual([TEXT]);
    expect(result).toEqual({ handle, cancelled: false });
  });

  it('re-prompts via Save As when the retained handle has gone stale', async () => {
    const staleHandle = { createWritable: vi.fn(async () => { throw new Error('permission revoked'); }) };
    const freshHandle = fakeHandle();
    vi.stubGlobal('showSaveFilePicker', vi.fn(async () => freshHandle));

    const result = await saveProject(TEXT, NAME, staleHandle as unknown as Parameters<typeof saveProject>[2]);

    expect(freshHandle.written).toEqual([TEXT]);
    expect(result).toEqual({ handle: freshHandle, cancelled: false });
  });
});
