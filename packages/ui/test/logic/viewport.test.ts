/**
 * `createViewportWatch` is the automatic half of the skin switch — `presentationState.ui
 * .skinOverride` (set from the Info menu) is the persisted, manual half. `node`, not `jsdom`
 * (`vitest.config.ts`'s `ui` project), so `window` doesn't exist here: every test stubs it via
 * `vi.stubGlobal`, mirroring `DiagnosticsModal-hooks.test.ts`'s own `window` stub for the same
 * reason.
 */
import {describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {createViewportWatch} from '../../src/logic/viewport.js';

type Listener = (e: { matches: boolean }) => void;

/** A minimal `MediaQueryList` stand-in: tracks the one `change` listener `createViewportWatch`
 *  registers, and `fire()` plays a media-query change the way a real browser would. */
function fakeMatchMedia(initialMatches: boolean) {
  let listener: Listener | null = null;
  const mql = {
    matches: initialMatches,
    addEventListener: (_type: string, cb: Listener) => { listener = cb; },
    removeEventListener: (_type: string, cb: Listener) => { if (listener === cb) listener = null; },
  };
  return { mql, fire: (matches: boolean) => { mql.matches = matches; listener?.({ matches }); } };
}

describe('createViewportWatch', () => {
  it('starts at the media query\'s current match state', () => {
    const { mql } = fakeMatchMedia(true);
    vi.stubGlobal('window', { matchMedia: () => mql });
    try {
      assert.equal(createViewportWatch().narrow.value, true);
    } finally { vi.unstubAllGlobals(); }
  });

  it('updates narrow when the media query later changes', () => {
    const { mql, fire } = fakeMatchMedia(false);
    vi.stubGlobal('window', { matchMedia: () => mql });
    try {
      const { narrow } = createViewportWatch();
      assert.equal(narrow.value, false);
      fire(true);
      assert.equal(narrow.value, true);
      fire(false);
      assert.equal(narrow.value, false);
    } finally { vi.unstubAllGlobals(); }
  });

  it('stop() removes the listener — a change after stop() is ignored', () => {
    const { mql, fire } = fakeMatchMedia(false);
    vi.stubGlobal('window', { matchMedia: () => mql });
    try {
      const { narrow, stop } = createViewportWatch();
      stop();
      fire(true);
      assert.equal(narrow.value, false, 'a change after stop() must not update narrow');
    } finally { vi.unstubAllGlobals(); }
  });

  it('passes its query argument straight through to matchMedia, defaulting to the mobile breakpoint', () => {
    let seenQuery = '';
    vi.stubGlobal('window', { matchMedia: (q: string) => { seenQuery = q; return fakeMatchMedia(false).mql; } });
    try {
      createViewportWatch();
      assert.equal(seenQuery, '(max-width: 600px)');
      createViewportWatch('(max-width: 480px)');
      assert.equal(seenQuery, '(max-width: 480px)');
    } finally { vi.unstubAllGlobals(); }
  });
});
