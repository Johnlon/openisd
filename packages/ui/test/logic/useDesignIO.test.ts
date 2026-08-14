/**
 * `bugs/BUG_20260814_sharelink-does-not-cancel-an-active-what-if-before-serialising-the-driver.md`
 *
 * Every I/O action in `useDesignIO.ts` must cancel an active driver what-if before it reads
 * modified state (`ARCHITECTURE.md` §3 "A what-if never leaks into anything persistent") — an
 * uncommitted, unverified overlay must never be left open once the user has generated an
 * artifact from the committed design. `saveProject`/`saveProjectAs`/`exportWdr`/`exportWpr`/
 * `exportOwdr` already do this via `endAnyActiveWhatIfBeforeIO()`; `shareLink()` was the one
 * that did not.
 */
import { describe, it, beforeAll, vi } from 'vitest';
import assert from 'node:assert/strict';
import { createLogging } from '../../src/logging/flash.js';
import { createDesignIO } from '../../src/logic/useDesignIO.js';
import { startDriverWhatIf, isDriverWhatIfActive } from '../../src/logic/store.js';

beforeAll(() => {
  // shareLink() reads location.{origin,pathname} (persist.ts's stateToUrl) and writes to the
  // clipboard/history — none exist in this suite's node environment. Stubbed exactly as
  // persist.test.ts stubs `location`, plus the two calls shareLink() itself makes.
  vi.stubGlobal('location', { origin: 'https://openisd.test', pathname: '/' });
  vi.stubGlobal('history', { replaceState: () => {} });
  vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } });
});

describe('shareLink() cancels an active what-if before serialising the driver', () => {
  it('an active what-if is gone after shareLink() returns', async () => {
    const io = createDesignIO({ logging: createLogging() });
    startDriverWhatIf();
    assert.equal(isDriverWhatIfActive.value, true, 'precondition: a what-if is open');

    await io.shareLink();

    assert.equal(isDriverWhatIfActive.value, false,
      'shareLink() must cancel the what-if itself, like every sibling export/save function');
  });
});
