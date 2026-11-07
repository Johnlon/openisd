/**
 * `createViewportWatch` is the automatic half of the skin switch — `presentationState.ui
 * .skinOverride` (set from the Info menu) is the persisted, manual half. `node`, not `jsdom`
 * (`vitest.config.ts`'s `ui` project), so `window` doesn't exist here: every test stubs it via
 * `vi.stubGlobal`, mirroring `DiagnosticsModal-hooks.test.ts`'s own `window` stub for the same
 * reason.
 */
import {describe, it, vi} from 'vitest';
import assert from 'node:assert/strict';
import {createViewportWatch, isSidewaysPhone, PHONE_LAYOUT_QUERY, SIDEWAYS_PHONE_MAX_HEIGHT_PX} from '../../src/logic/viewport.js';

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
      assert.equal(seenQuery, PHONE_LAYOUT_QUERY);
      createViewportWatch('(max-width: 480px)');
      assert.equal(seenQuery, '(max-width: 480px)');
    } finally { vi.unstubAllGlobals(); }
  });
});

describe('PHONE_LAYOUT_QUERY (QO418: a phone turned sideways keeps the phone layout)', () => {
  it('is a narrow window, or a touch screen with a short window', () => {
    assert.equal(PHONE_LAYOUT_QUERY, '(max-width: 600px), (pointer: coarse) and (max-height: 500px)');
  });
});

describe('one definition of a sideways phone', () => {
  it('the query and isSidewaysPhone share one height figure', () => {
    assert.ok(PHONE_LAYOUT_QUERY.includes(`(max-height: ${SIDEWAYS_PHONE_MAX_HEIGHT_PX}px)`));
  });
  it('is true for 705x374 and 850x390 and a 900x400 window, false for upright and desktop', () => {
    const size = (innerWidth: number, innerHeight: number) => ({innerWidth, innerHeight});
    assert.equal(isSidewaysPhone(size(705, 374)), true);
    assert.equal(isSidewaysPhone(size(850, 390)), true);
    assert.equal(isSidewaysPhone(size(900, 400)), true);
    assert.equal(isSidewaysPhone(size(374, 705)), false);
    assert.equal(isSidewaysPhone(size(1280, 720)), false);
  });
});
