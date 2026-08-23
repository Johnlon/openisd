/**
 * Reads a WinISD file into text and writes it back out.
 *
 * A .wdr is INI text: [Section] headers and key=value lines. But a file is bytes, and you need
 * the encoding before you can read it. WinISD only ran on Windows, so old files are CP1252 and
 * newer ones UTF-8. We try UTF-8, fall back to CP1252, and report which we used. We always write
 * UTF-8. .wpr files come through here too, since a .wpr has a .wdr inside its [Driver] section.
 *
 * The other job is comments. A comment can run to several lines, but every line of the file has
 * to mean one thing, so WinISD stores a newline inside a value as the byte 0xA4 and keeps the
 * comment on one line.
 *
 * You can't just swap every 0xA4 for a newline. It never starts a UTF-8 character, which is why
 * WinISD could use it as a marker, but it does appear inside one: ¤ is C2 A4, € is E2 82 AC.
 * So we walk whole characters and only treat 0xA4 as a marker where a character starts.
 *
 * In memory it becomes U+F8A4, a private-use code point that can't collide with real text.
 * fromWdrIni turns it into a newline, toWdr turns it back. The Python side does the same thing
 * in winisd_tools/scrapers/scrapers/lib/wdr_ini_file.py.
 */

/** In-memory stand-in for the file's `0xA4`. Private-use, so it cannot collide with content. */
export const WINISD_NEWLINE_SENTINEL = '';

/** UTF-8 for `U+F8A4`. The three bytes the file collapses to a single `0xA4`. */
const SENTINEL_UTF8 = [0xef, 0xa2, 0xa4] as const;

/**
 * Which character encoding `winisdBytesToText` found the file to be in (QO62, human ruling
 * 2026-08-21). A file that is not valid UTF-8 is read as Windows CP1252 rather than treated as
 * damaged, because classic WinISD only ever ran on Windows. The caller is told which applied so
 * it can say so.
 */
export enum WinisdEncoding {
  Utf8 = 'utf-8',
  Cp1252 = 'cp1252',
}

/** `winisdBytesToText`'s result: the decoded text, and which encoding produced it. */
export interface WinisdDecodedText {
  readonly text: string;
  readonly encoding: WinisdEncoding;
}

/** How many bytes the UTF-8 sequence led by `b` occupies, or 1 for a byte that leads nothing
 *  (an invalid lead, including a bare `0xA4`). */
function sequenceLength(b: number): number {
  if (b < 0x80) return 1;
  if (b >= 0xc2 && b <= 0xdf) return 2;
  if (b >= 0xe0 && b <= 0xef) return 3;
  if (b >= 0xf0 && b <= 0xf4) return 4;
  return 1;
}

/** Re-expands every lead-position `0xA4` in `bytes` to `SENTINEL_UTF8`, leaving an `0xA4` that
 *  sits INSIDE a valid UTF-8 sequence — the second byte of `¤`, the third of `€` — untouched.
 *  Only meaningful ahead of a UTF-8 decode; CP1252 has no multi-byte sequences to protect. */
function expandSentinelForUtf8(bytes: Uint8Array<ArrayBufferLike>): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i];
    if (b === 0xa4) {
      out.push(...SENTINEL_UTF8);
      i += 1;
      continue;
    }
    const n = sequenceLength(b);
    for (let k = 0; k < n && i + k < bytes.length; k++) out.push(bytes[i + k]);
    i += n;
  }
  return new Uint8Array(out);
}

/**
 * `.wdr` file bytes → text, with every newline sentinel turned into `WINISD_NEWLINE_SENTINEL`.
 * Pair with `winisdTextToBytes`. The result still needs `fromWdrIni` to turn the sentinel into a
 * real newline inside each value — that step is per-FIELD, and this one cannot tell fields
 * apart.
 *
 * QO62 (human ruling, 2026-08-21): classic WinISD is Windows-only, so a file already in
 * circulation is overwhelmingly likely to be CP1252 where it is not UTF-8. A strict UTF-8
 * decode is tried first; on failure the WHOLE FILE is re-decoded as CP1252 — never a mixed or
 * per-line decode, because a mixed-encoding file is not a thing WinISD can produce. The result
 * reports which encoding was used so the caller (the UI) can say so.
 */
export function winisdBytesToText(bytes: Uint8Array<ArrayBufferLike>): WinisdDecodedText {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(expandSentinelForUtf8(bytes));
    return { text, encoding: WinisdEncoding.Utf8 };
  } catch {
    // CP1252 0xA4 is genuinely ambiguous: it is the code page's own currency sign ¤, AND it is
    // WinISD's newline byte — the wine probe behind the QO62 ruling typed an Enter keystroke
    // and WinISD wrote a bare 0xA4 for it, so in a real file the byte means newline in
    // practice. Every 0xA4 is read as the sentinel; a genuine ¤ character, if one exists in a
    // CP1252 file, is accepted as a loss (documented by the "¤ reads back as a newline" test).
    const text = new TextDecoder('windows-1252').decode(bytes).replaceAll('¤', WINISD_NEWLINE_SENTINEL);
    return { text, encoding: WinisdEncoding.Cp1252 };
  }
}

/**
 * Text → `.wdr` file bytes: UTF-8, with `WINISD_NEWLINE_SENTINEL` collapsed back to the single
 * `0xA4` the format specifies. Pair with `winisdBytesToText`.
 *
 * The text handed in is `WinISDDriver.toWdr()`'s output, which has already put the sentinel
 * where a value's newlines were — so no line structure is at risk here.
 */
export function winisdTextToBytes(text: string): Uint8Array<ArrayBuffer> {
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
