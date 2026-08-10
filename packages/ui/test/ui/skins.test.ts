/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/ui-presentation/spec.md?html
 */
/**
 * Skin resolution — the pure mapping from a chosen skin to the shell that renders it.
 *
 * `classic` is MOTHBALLED: retired from the picker (not in SKIN_IDS) but still resolves,
 * so a user who persisted it keeps rendering. `auto` resolves to the default responsive
 * shell (today `modern`; when modern-plus ships this flips). The picker lists only the
 * offered skins, so no dead or retired options appear.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { resolveSkin, SKIN_IDS, type SkinId } from '../../src/ui/skins.js';

describe('skin resolution', () => {
  it('classic still resolves to the classic shell (mothballed, kept for a persisted pref)', () => {
    assert.equal(resolveSkin('classic'), 'classic');
  });

  it('modern resolves to the modern shell', () => {
    assert.equal(resolveSkin('modern'), 'modern');
  });

  it('auto resolves to the default responsive shell (original for now)', () => {
    assert.equal(resolveSkin('auto'), 'original');
  });

  it('original passes straight through to the original shell (the mock recreation)', () => {
    assert.equal(resolveSkin('original'), 'original');
  });

  it('SKIN_IDS lists exactly the OFFERED skins, auto first — Classic, Original and Modern are all listed', () => {
    const expected: SkinId[] = ['auto', 'classic', 'original', 'modern'];
    assert.deepEqual(SKIN_IDS, expected);
  });

  it('classic is present in the picker and resolves to the classic shell', () => {
    assert.ok(SKIN_IDS.includes('classic'), 'Classic must be offered in the picker');
    assert.equal(resolveSkin('classic'), 'classic', 'and resolves to classic shell');
  });
});
