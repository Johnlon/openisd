/**
 * Specification: http://localhost:8000/winisd/openisd/openspec/specs/driver-editor/spec.md?html
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { getProvenanceInfo, PROVENANCE_MAP } from '../src/utils/provenance.js';

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

  it('substitutes live values into formula text', () => {
    const info = getProvenanceInfo('Qts', { Qes: 0.4, Qms: 4.0 });
    assert.ok(info);
    const sub = info.paths[0].substitutedText ?? '';
    assert.match(sub, /0.4/);
    assert.match(sub, /4/);
  });
});
