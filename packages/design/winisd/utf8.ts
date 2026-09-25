/**
 * UTF-8 encoding for the embedded V8 the bridge runs in.
 *
 * `TextEncoder` is not there — mini-racer's V8 is a bare context with no web platform on top of
 * it — so the bytes are derived from each code point arithmetically instead.
 * `bridge-bundle.test.ts` runs the bundle in a sandbox with that global removed and proves the
 * absence is real.
 */

/** `text` as UTF-8 bytes, exactly as `TextEncoder` would produce them. */
export function utf8Bytes(text: string): Uint8Array<ArrayBuffer> {
  const out: number[] = [];
  // `for…of` walks whole code points, so an astral character arrives once rather than as its
  // two surrogates.
  for (const character of text) {
    for (const byte of characterBytes(character)) out.push(byte);
  }
  return new Uint8Array(out);
}

/** One character's UTF-8 bytes. A string with no code point at all encodes to nothing. */
function characterBytes(character: string): readonly number[] {
  const cp = character.codePointAt(0);
  if (cp === undefined) return [];
  if (cp < 0x80) return [cp];
  if (cp < 0x800) return [0xc0 | (cp >> 6), 0x80 | (cp & 0x3f)];
  if (cp < 0x10000)
    return [0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f)];
  return [
    0xf0 | (cp >> 18),
    0x80 | ((cp >> 12) & 0x3f),
    0x80 | ((cp >> 6) & 0x3f),
    0x80 | (cp & 0x3f),
  ];
}
