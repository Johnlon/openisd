/**
 * `utf8Bytes` — UTF-8 encoding derived arithmetically, for the embedded V8 the bridge runs in,
 * which has no `TextEncoder` (`bridge-bundle.test.ts` is the sandbox that proves it).
 *
 * Every case is checked against `TextEncoder` itself: the point of the function is to agree
 * with it exactly, so nothing else is a fair oracle.
 */
import {describe, expect, it} from 'vitest';

import {utf8Bytes} from '../../winisd/utf8.js';

function reference(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

function check(text: string): void {
  expect(Array.from(utf8Bytes(text))).toEqual(reference(text));
}

describe('utf8Bytes', () => {
  it('encodes the empty string as no bytes', () => {
    expect(Array.from(utf8Bytes(''))).toEqual([]);
  });

  it('encodes ASCII one byte per character', () => {
    check('[Driver]\r\nFs=37\r\n');
  });

  it('encodes a two-byte code point', () => {
    check('¤ ü Ω µ °');
  });

  it('encodes a three-byte code point', () => {
    check('€ 中 文 ✓ ');
  });

  it('encodes an astral code point as a surrogate pair, four bytes', () => {
    check('😀🔊🎵');
  });

  it('encodes the newline sentinel as EF A2 A4', () => {
    expect(Array.from(utf8Bytes(''))).toEqual([0xef, 0xa2, 0xa4]);
  });

  it('agrees with TextEncoder across the whole BMP', () => {
    for (let cp = 0; cp < 0x10000; cp++) {
      if (cp >= 0xd800 && cp <= 0xdfff) continue; // lone surrogates are not text
      const text = String.fromCodePoint(cp);
      expect(Array.from(utf8Bytes(text))).toEqual(reference(text));
    }
  });
});
