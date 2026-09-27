/**
 * The persisted, manual half of the skin switch. The automatic half is `createViewportWatch`
 * (`logic/viewport.ts`) feeding `presentationState.narrowViewport`; `App.vue`'s `activeSkin`
 * combines the two, override winning when present.
 */
import {describe, it} from 'vitest';
import assert from 'node:assert/strict';
import {presentationState, setSkinOverride} from '../../src/logic/presentationState.js';

describe('setSkinOverride', () => {
  it('has no override by default', () => {
    assert.equal(presentationState.ui.skinOverride, undefined);
  });

  it('sets an explicit override', () => {
    setSkinOverride('mobile');
    assert.equal(presentationState.ui.skinOverride, 'mobile');
    setSkinOverride('original');
    assert.equal(presentationState.ui.skinOverride, 'original');
  });

  it('null clears the override back to absent, not to a stored null', () => {
    setSkinOverride('mobile');
    setSkinOverride(null);
    assert.equal(presentationState.ui.skinOverride, undefined);
    assert.equal('skinOverride' in presentationState.ui, false,
      'a cleared override must not round-trip to storage as a literal null');
  });
});

describe('presentationState.narrowViewport', () => {
  it('defaults to false and is never persisted (it is not part of .ui)', () => {
    assert.equal(presentationState.narrowViewport, false);
  });
});
