import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { getProvenanceInfo, PROVENANCE_MAP } from '../../src/logic/provenance.js';

describe('Driver Field Provenance Inspector Engine', () => {
  it('defines provenance mapping for core T/S parameters', () => {
    assert.ok(PROVENANCE_MAP.Qts, 'Qts must have provenance information');
    assert.ok(PROVENANCE_MAP.Qes, 'Qes must have provenance information');
    assert.ok(PROVENANCE_MAP.Fs, 'Fs must have provenance information');
    assert.ok(PROVENANCE_MAP.Mms, 'Mms must have provenance information');
  });

  it('returns single formula path for single-derivation fields like Qts', () => {
    const info = getProvenanceInfo('Qts');
    assert.ok(info, 'Qts info must exist');
    assert.equal(info.paths.length, 1);
    assert.deepEqual(info.paths[0].inputs, ['Qes', 'Qms']);
    assert.match(info.paths[0].formulaText, /Qes/);
  });

  it('returns multi-path derivations for dual-formula fields like Qes and Mms', () => {
    const qesInfo = getProvenanceInfo('Qes');
    assert.ok(qesInfo, 'Qes info must exist');
    assert.ok(qesInfo.paths.length >= 2, 'Qes must have at least 2 derivation paths');

    const mmsInfo = getProvenanceInfo('Mms');
    assert.ok(mmsInfo, 'Mms info must exist');
    assert.ok(mmsInfo.paths.length >= 2, 'Mms must have at least 2 derivation paths');
    assert.notEqual(mmsInfo.paths[0].color, mmsInfo.paths[1].color, 'Each path must carry a distinct color');
  });

  /* The inspector tells the user how a value was reached, so a path that names inputs the
   * engine does not actually use is a lie about our own code. Rme takes 2π·Fs·Mms/Qes in
   * preference to Bl²/Re (engine driver.ts block 13), and Mpow is √Rme so that it cannot
   * print a number contradicting the Rme beside it. */
  it('the Advanced figures of merit name the inputs the engine really uses', () => {
    assert.deepEqual(getProvenanceInfo('Rme')?.paths[0].inputs, ['Fs', 'Mms', 'Qes']);
    assert.deepEqual(getProvenanceInfo('gamma')?.paths[0].inputs, ['BL', 'Mms']);
    assert.deepEqual(getProvenanceInfo('Mpow')?.paths[0].inputs, ['Rme'],
      'Mpow is derived from Rme, not independently from Bl and Re');
    assert.deepEqual(getProvenanceInfo('SPLmax')?.paths[0].inputs, ['SPL', 'Pe']);
    assert.match(getProvenanceInfo('SPLmax')?.paths[0].formulaText ?? '', /Pe/);
  });

  it('substitutes live values into formula text', () => {
    const info = getProvenanceInfo('Qts', { Qes: 0.4, Qms: 4.0 });
    assert.ok(info);
    const sub = info.paths[0].substitutedText ?? '';
    assert.match(sub, /0.4/);
    assert.match(sub, /4/);
  });
});
