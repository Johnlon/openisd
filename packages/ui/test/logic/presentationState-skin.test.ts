/**
 * The persisted, manual half of the skin switch. The automatic half is `createViewportWatch`
 * (`logic/viewport.ts`) feeding `presentationState.narrowViewport`; `App.vue`'s `activeSkin`
 * combines the two, override winning when present.
 */
import {describe, it, beforeEach} from 'vitest';
import assert from 'node:assert/strict';
import {createAppStateFixture} from '../fixtures/appStateFixture.js';
import type {PresentationState} from '../../src/logic/presentationState.js';

let presentationState: PresentationState;

beforeEach(() => {
  const fixture = createAppStateFixture();
  presentationState = fixture.presentation;
});

describe('setSkinOverride', () => {
  it('has no override by default', () => {
    assert.equal(presentationState.ui.skinOverride, undefined);
  });

  it('sets an explicit override', () => {
    presentationState.setSkinOverride('mobile');
    assert.equal(presentationState.ui.skinOverride, 'mobile');
    presentationState.setSkinOverride('original');
    assert.equal(presentationState.ui.skinOverride, 'original');
  });

  it('null clears the override back to absent, not to a stored null', () => {
    presentationState.setSkinOverride('mobile');
    presentationState.setSkinOverride(null);
    assert.equal(presentationState.ui.skinOverride, undefined);
    assert.equal('skinOverride' in presentationState.ui, false,
      'a cleared override must not round-trip to storage as a literal null');
  });
});

describe('shownSkin', () => {
  it('follows the window width when there is no override', () => {
    presentationState.narrowViewport = false;
    assert.equal(presentationState.shownSkin(), 'original');
    presentationState.narrowViewport = true;
    assert.equal(presentationState.shownSkin(), 'mobile');
  });

  it('is the override when one is set, whatever the window width', () => {
    presentationState.narrowViewport = true;
    presentationState.setSkinOverride('original');
    assert.equal(presentationState.shownSkin(), 'original');
    presentationState.narrowViewport = false;
    presentationState.setSkinOverride('mobile');
    assert.equal(presentationState.shownSkin(), 'mobile');
  });

  it('follows the window width again once the override is cleared', () => {
    presentationState.narrowViewport = true;
    presentationState.setSkinOverride('original');
    presentationState.setSkinOverride(null);
    assert.equal(presentationState.shownSkin(), 'mobile');
  });
});

describe('presentationState.narrowViewport', () => {
  it('defaults to false and is never persisted (it is not part of .ui)', () => {
    assert.equal(presentationState.narrowViewport, false);
  });
});


it('starts charts at 10 Hz to 1 kHz', () => {
  assert.deepEqual(presentationState.sweepRange, {min:10,max:1000});
});
