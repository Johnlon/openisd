/**
 * Skin resolution — the pure mapping from a chosen skin to the shell that renders it.
 *
 * `classic` is manual-only (a WinISD-recreation nostalgia mode). `auto` resolves to the
 * default responsive shell (today that is `modern`; when modern-plus ships this flips).
 * The picker only lists skins whose shell actually exists, so no dead options appear.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { resolveSkin, SKIN_IDS, type SkinId } from '../src/skins.js';

describe('skin resolution', () => {
  it('classic passes straight through to the classic shell', () => {
    assert.equal(resolveSkin('classic'), 'classic');
  });

  it('modern resolves to the modern shell', () => {
    assert.equal(resolveSkin('modern'), 'modern');
  });

  it('auto resolves to the default responsive shell (modern for now)', () => {
    assert.equal(resolveSkin('auto'), 'modern');
  });

  it('SKIN_IDS lists exactly the selectable skins, auto first', () => {
    const expected: SkinId[] = ['auto', 'classic', 'modern'];
    assert.deepEqual(SKIN_IDS, expected);
  });
});
