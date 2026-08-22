/**
 * `fileFormat.ts`'s classification functions — `formatOf` (by file name) and `sniff` (by
 * content): the ONE place either classification rule lives (QO67).
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { DriverFileFormat, ProjectFileFormat, formatOf, sniff } from '../../src/fileFormat.js';
import { wdrTextToBytes } from '@openisd/winisd';

describe('formatOf — file-name classification across both format families', () => {
  it('identifies every known driver and project extension', () => {
    assert.equal(formatOf('x.wdr'), DriverFileFormat.Wdr);
    assert.equal(formatOf('x.owdr'), DriverFileFormat.Owdr);
    assert.equal(formatOf('x.wpr'), ProjectFileFormat.Wpr);
    assert.equal(formatOf('x.owpr'), ProjectFileFormat.Owpr);
    assert.equal(formatOf('x.txt'), undefined);
  });
});

describe('sniff — content classification when the name does not say', () => {
  it('tells .wdr from .wpr by INI section headers', () => {
    assert.equal(sniff(wdrTextToBytes('[Driver]\nBrand=x\n')), DriverFileFormat.Wdr);
    assert.equal(sniff(wdrTextToBytes('[ProjectInfo]\n[Driver]\n[Box]\nBType=0\n')), ProjectFileFormat.Wpr);
  });
  it('tells a driver record from a project payload by JSON shape', () => {
    assert.equal(sniff(new TextEncoder().encode('{"specs":{}}')), DriverFileFormat.Owdr);
    assert.equal(sniff(new TextEncoder().encode('{"box":"sealed","P":{}}')), ProjectFileFormat.Owpr);
  });
  it('answers undefined for bytes it cannot classify', () => {
    assert.equal(sniff(new TextEncoder().encode('not a known format')), undefined);
    assert.equal(sniff(new Uint8Array([0xff, 0xfe, 0xae])), undefined);
  });
});
