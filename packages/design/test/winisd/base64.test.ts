/**
 * `bytesToBase64` — how the bridge carries a file's BYTES across the V8 boundary, whose only
 * transport is a JSON string. The embedded V8 has no `btoa` and no `Buffer`, so the encoder is
 * written out here and checked against Node's `Buffer`, which is the oracle the Python side's
 * `base64.b64decode` agrees with.
 */
import {describe, expect, it} from 'vitest';

import {bytesToBase64} from '../../winisd/base64.js';

function reference(bytes: number[]): string {
  return Buffer.from(bytes).toString('base64');
}

function check(bytes: number[]): void {
  expect(bytesToBase64(new Uint8Array(bytes))).toEqual(reference(bytes));
}

describe('bytesToBase64', () => {
  it('encodes no bytes as the empty string', () => {
    expect(bytesToBase64(new Uint8Array([]))).toEqual('');
  });

  it('pads a length that is one over a group of three', () => {
    check([0x41]);
  });

  it('pads a length that is two over a group of three', () => {
    check([0x41, 0x42]);
  });

  it('encodes a whole group of three unpadded', () => {
    check([0x41, 0x42, 0x43]);
  });

  it('encodes the wdr newline marker, which is not valid UTF-8 on its own', () => {
    check([0x5b, 0x44, 0x72, 0x69, 0x76, 0x65, 0x72, 0x5d, 0x0d, 0x0a, 0xa4]);
  });

  it('encodes every byte value', () => {
    check(Array.from({length: 256}, (_, i) => i));
  });

  it('encodes a long run, where a table-driven encoder would drift', () => {
    check(Array.from({length: 1000}, (_, i) => (i * 37) & 0xff));
  });
});
