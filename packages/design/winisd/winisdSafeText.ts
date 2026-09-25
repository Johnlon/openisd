/**
 * Rewrites a string so WinISD can both draw it and store it.
 *
 * Measured on WinISD Pro under Windows 11, 2026-09-25. WinISD holds text as Unicode and writes
 * UTF-8 — a probe carrying `€ 中 文 Ж ✓ ✗ ∀ ⊗ ℧ ₹ ą 😀` came back from its own Save byte for
 * byte — so nothing here is a codepage conversion. Two narrower faults remain:
 *
 * GLYPHS. The driver editor draws with the OEM raster font, whose repertoire is CP437/CP850:
 * `₧` appears as `Pts`, that font's literal glyph for CP437 0x9E. Characters outside the
 * repertoire fall back per SCRIPT, so CJK, emoji, Cyrillic and maths all render, but the Latin
 * punctuation block has no fallback and draws .notdef — a vertical bar. That is the entire
 * failing set, and `GLYPH_TRANSLATIONS` is it.
 *
 * BYTES. WinISD splits a value on the raw byte `0xA4` — its in-value newline marker — BEFORE
 * decoding UTF-8, so a character whose encoding merely CONTAINS that byte is torn in half.
 * `≤` (`E2 89 A4`) came back from WinISD as `?` followed by a line break. 50,323 code points
 * encode with that byte; `ä` (`C3 A4`) is the one that turns up in driver text.
 *
 * The glyph fault is cosmetic and the byte fault corrupts the file, but both are fixed the same
 * way and in the same place — here, on the record's string values, before either derived file is
 * written, so the `.wdr` never carries a character WinISD cannot handle.
 *
 * `winisdBytes.ts` is the other half of the story and stays separate: this module decides what
 * text may say, that one decides how text becomes bytes.
 */
import { WINISD_NEWLINE_SENTINEL } from './winisdBytes.js';

/** One character this module rewrote, and what it became. `to` is never empty. */
export interface WinisdTextChange {
  from: string;
  to: string;
}

/** A string WinISD can draw and store, plus every rewrite that got it there. */
export interface WinisdSafeText {
  text: string;
  changes: readonly WinisdTextChange[];
}

/**
 * Characters the driver editor draws as .notdef, and the ASCII John approved for each
 * (2026-09-25, reading them off the editor). Every one is a Latin punctuation or Latin
 * Extended-A code point; nothing else in the probe failed.
 */
const GLYPH_TRANSLATIONS: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(['–', '-'] as const), // EN DASH
  Object.freeze(['—', '-'] as const), // EM DASH
  Object.freeze(['“', '"'] as const), // LEFT DOUBLE QUOTATION MARK
  Object.freeze(['”', '"'] as const), // RIGHT DOUBLE QUOTATION MARK
  Object.freeze(['″', '"'] as const), // DOUBLE PRIME — draws, but at a fallback font's size
  Object.freeze(['‘', "'"] as const), // LEFT SINGLE QUOTATION MARK
  Object.freeze(['’', "'"] as const), // RIGHT SINGLE QUOTATION MARK
  Object.freeze(['™', '(TM)'] as const), // TRADE MARK SIGN
  Object.freeze(['‹', '<'] as const), // SINGLE LEFT-POINTING ANGLE QUOTATION MARK
  Object.freeze(['›', '>'] as const), // SINGLE RIGHT-POINTING ANGLE QUOTATION MARK
  Object.freeze(['…', '...'] as const), // HORIZONTAL ELLIPSIS
  Object.freeze(['†', '*'] as const), // DAGGER
  Object.freeze(['‡', '**'] as const), // DOUBLE DAGGER
  Object.freeze(['‰', 'o/oo'] as const), // PER MILLE SIGN
  Object.freeze(['Œ', 'OE'] as const), // LATIN CAPITAL LIGATURE OE
  Object.freeze(['œ', 'oe'] as const), // LATIN SMALL LIGATURE OE
  Object.freeze(['Š', 'S'] as const), // LATIN CAPITAL LETTER S WITH CARON
  Object.freeze(['š', 's'] as const), // LATIN SMALL LETTER S WITH CARON
  Object.freeze(['Ž', 'Z'] as const), // LATIN CAPITAL LETTER Z WITH CARON
  Object.freeze(['ž', 'z'] as const), // LATIN SMALL LETTER Z WITH CARON
  Object.freeze(['Ÿ', 'Y'] as const), // LATIN CAPITAL LETTER Y WITH DIAERESIS
  Object.freeze(['ƒ', 'f'] as const), // LATIN SMALL LETTER F WITH HOOK
  Object.freeze([' ', ' '] as const), // NO-BREAK SPACE
]);

/**
 * Code points whose UTF-8 carries `0xA4` and that have an agreed spelling. `ä` is the only one
 * that turns up in driver text — German brand and model names — and German spells it `ae`, so
 * dropping the letter would be the wrong repair.
 */
const MARKER_BYTE_TRANSLATIONS: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(['ä', 'ae'] as const), // LATIN SMALL LETTER A WITH DIAERESIS — C3 A4
  Object.freeze(['≤', '<='] as const), // LESS-THAN OR EQUAL TO — E2 89 A4
]);

/**
 * `≥` has no fault of its own — it is CP437 0xF2 and its UTF-8 is `E2 89 A5` — but `≤` above is
 * rewritten, and a comparison that shows one side as ASCII and the other as a symbol reads as a
 * mistake. John, 2026-09-25: "and >=".
 */
const PAIRED_ASCII_SPELLINGS: readonly (readonly [string, string])[] = Object.freeze([
  Object.freeze(['≥', '>='] as const), // GREATER-THAN OR EQUAL TO
]);

/**
 * What a `0xA4`-carrying character becomes when nothing above spells it. Visible on purpose
 * (John, 2026-09-25): a dropped character leaves a reader nothing to notice. `¿` is `C2 BF`, so
 * it carries no marker byte of its own, and it sits at CP437 0xA8, so the OEM font draws it.
 */
const MARKER_BYTE_PLACEHOLDER = '¿';

/** WinISD's in-value newline marker, the one byte that is MEANT to be there. */
const MARKER_BYTE = 0xa4;

/**
 * Whether WinISD's value splitter would tear this character in half.
 *
 * The UTF-8 bytes are derived arithmetically rather than with `TextEncoder`, which the embedded
 * V8 the bridge runs in does not provide — `bridge-bundle.test.ts` is the sandbox that proves it.
 */
function carriesMarkerByte(character: string): boolean {
  const codePoint = character.codePointAt(0);
  if (codePoint === undefined || codePoint < 0x80) return false;
  if (codePoint < 0x800)
    return isMarker(0xc0 | (codePoint >> 6)) || isMarker(0x80 | (codePoint & 0x3f));
  if (codePoint < 0x10000)
    return (
      isMarker(0xe0 | (codePoint >> 12)) ||
      isMarker(0x80 | ((codePoint >> 6) & 0x3f)) ||
      isMarker(0x80 | (codePoint & 0x3f))
    );
  return (
    isMarker(0xf0 | (codePoint >> 18)) ||
    isMarker(0x80 | ((codePoint >> 12) & 0x3f)) ||
    isMarker(0x80 | ((codePoint >> 6) & 0x3f)) ||
    isMarker(0x80 | (codePoint & 0x3f))
  );
}

function isMarker(byte: number): boolean {
  return byte === MARKER_BYTE;
}

/** The replacement for one character, or null to keep it as it stands. */
function replacementFor(character: string): string | null {
  for (const [from, to] of GLYPH_TRANSLATIONS) if (character === from) return to;
  for (const [from, to] of MARKER_BYTE_TRANSLATIONS) if (character === from) return to;
  for (const [from, to] of PAIRED_ASCII_SPELLINGS) if (character === from) return to;
  if (character === WINISD_NEWLINE_SENTINEL) return null;
  return carriesMarkerByte(character) ? MARKER_BYTE_PLACEHOLDER : null;
}

/**
 * `text` rewritten for WinISD, with one `changes` entry per character rewritten, in the order
 * they occur. Iterated by code point, so an astral character is judged whole rather than as two
 * surrogates.
 */
export function winisdSafeText(text: string): WinisdSafeText {
  const parts: string[] = [];
  const changes: WinisdTextChange[] = [];
  for (const character of text) {
    const replacement = replacementFor(character);
    if (replacement === null) {
      parts.push(character);
      continue;
    }
    parts.push(replacement);
    changes.push({ from: character, to: replacement });
  }
  return { text: parts.join(''), changes };
}
