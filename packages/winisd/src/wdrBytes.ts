/**
 * The `.wdr` BYTE boundary — the one place that knows a `.wdr` file is bytes rather than text.
 *
 * A `.wdr` string field may contain embedded newlines, and WinISD encodes each one as the
 * single byte `0xA4` so that `Comment=` stays on ONE physical line. Every other line-oriented
 * part of the format — key=value, `[Section]`, the ParState row — depends on that being true.
 *
 * `0xA4` is not a legal UTF-8 LEAD byte, which is exactly why it can serve as a sentinel: no
 * character encodes to it in that position. It IS a legal CONTINUATION byte, though — `¤` is
 * `C2 A4` and `€` is `E2 82 AC` — so a byte-for-byte substitution would corrupt real text.
 * The decoder below therefore walks UTF-8 sequences and treats an `0xA4` as the sentinel ONLY
 * where a sequence starts.
 *
 * In memory the sentinel is `U+F8A4`, a private-use code point, matching the reference
 * implementation (`winisd_tools/scrapers/scrapers/lib/wdr_ini_file.py`). Keeping it distinct
 * from `\n` all the way to `fromWdrIni` is what lets the parser split lines unambiguously;
 * `fromWdrIni` turns it into `\n` inside a value, and `toWdr` turns `\n` back into it.
 */

/** In-memory stand-in for the file's `0xA4`. Private-use, so it cannot collide with content. */
export const WDR_NEWLINE_SENTINEL = '';

/** UTF-8 for `U+F8A4`. The three bytes the file collapses to a single `0xA4`. */
const SENTINEL_UTF8 = [0xef, 0xa2, 0xa4] as const;

/** How many bytes the UTF-8 sequence led by `b` occupies, or 1 for a byte that leads nothing
 *  (an invalid lead, including a bare `0xA4`). */
function sequenceLength(b: number): number {
  if (b < 0x80) return 1;
  if (b >= 0xc2 && b <= 0xdf) return 2;
  if (b >= 0xe0 && b <= 0xef) return 3;
  if (b >= 0xf0 && b <= 0xf4) return 4;
  return 1;
}

/**
 * `.wdr` file bytes → text, with every newline sentinel turned into `WDR_NEWLINE_SENTINEL`.
 * Pair with `wdrTextToBytes`. The result still needs `fromWdrIni` to turn the sentinel into a
 * real newline inside each value — that step is per-FIELD, and this one cannot tell fields
 * apart.
 */
export function wdrBytesToText(bytes: Uint8Array<ArrayBufferLike>): string {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b === 0xa4) {
      // A lead-position 0xA4: the sentinel. Re-expand it so the UTF-8 decode below yields
      // U+F8A4 rather than a replacement character.
      out.push(...SENTINEL_UTF8);
      i += 1;
      continue;
    }
    // Anything else is copied whole, so an 0xA4 sitting INSIDE a valid sequence — the second
    // byte of `¤`, the third of `€` — is carried across untouched.
    const n = sequenceLength(b);
    for (let k = 0; k < n && i + k < bytes.length; k++) out.push(bytes[i + k]);
    i += n;
  }
  return new TextDecoder('utf-8').decode(new Uint8Array(out));
}

/**
 * Text → `.wdr` file bytes: UTF-8, with `WDR_NEWLINE_SENTINEL` collapsed back to the single
 * `0xA4` the format specifies. Pair with `wdrBytesToText`.
 *
 * The text handed in is `WinISDDriver.toWdr()`'s output, which has already put the sentinel
 * where a value's newlines were — so no line structure is at risk here.
 */
export function wdrTextToBytes(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text);
  const out: number[] = [];
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === SENTINEL_UTF8[0] && encoded[i + 1] === SENTINEL_UTF8[1]
        && encoded[i + 2] === SENTINEL_UTF8[2]) {
      out.push(0xa4);
      i += 2;
      continue;
    }
    out.push(encoded[i]);
  }
  return new Uint8Array(out);
}
