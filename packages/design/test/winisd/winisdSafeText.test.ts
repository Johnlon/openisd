/**
 * `winisdSafeText` — what a record's text must become before WinISD sees it.
 *
 * Two separate failures, measured on WinISD Pro under Windows 11 (2026-09-25):
 *
 * 1. GLYPHS. WinISD's driver editor draws with the OEM raster font, whose repertoire is
 *    CP437/CP850 (`₧` draws as `Pts`, that font's literal glyph for CP437 0x9E). Characters
 *    outside it fall back per script — CJK, emoji, Cyrillic and maths all render — but the
 *    Latin punctuation block gets no fallback and draws .notdef, a vertical bar.
 * 2. BYTES. WinISD splits a value on the raw byte `0xA4` BEFORE decoding UTF-8, so any
 *    character whose encoding contains that byte is torn in half. `≤` (`E2 89 A4`) came back
 *    from WinISD as `?` plus a line break. `ä` is `C3 A4` and breaks the same way.
 *
 * (1) is cosmetic, (2) corrupts the file.
 */
import { describe, expect, it } from 'vitest';

import { WINISD_NEWLINE_SENTINEL } from '../../winisd/winisdBytes.js';
import { winisdSafeText } from '../../winisd/winisdSafeText.js';

describe('winisdSafeText — glyph translations John approved', () => {
  const cases: readonly (readonly [string, string])[] = [
    ['–', '-'],
    ['—', '-'],
    ['“', '"'],
    ['”', '"'],
    ['″', '"'],
    ['‘', "'"],
    ['’', "'"],
    ['™', '(TM)'],
    ['‹', '<'],
    ['›', '>'],
    ['…', '...'],
    ['†', '*'],
    ['‡', '**'],
    ['‰', 'o/oo'],
    ['Œ', 'OE'],
    ['œ', 'oe'],
    ['Š', 'S'],
    ['š', 's'],
    ['Ž', 'Z'],
    ['ž', 'z'],
    ['Ÿ', 'Y'],
    ['ƒ', 'f'],
    [' ', ' '],
  ];

  for (const [from, to] of cases) {
    it(`U+${from.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} becomes ${JSON.stringify(to)}`, () => {
      expect(winisdSafeText(`x${from}y`).text).toBe(`x${to}y`);
    });
  }

  it('reports each translation it made', () => {
    const result = winisdSafeText('Dayton™ 8″');
    expect(result.text).toBe('Dayton(TM) 8"');
    expect(result.changes).toEqual([
      { from: '™', to: '(TM)' },
      { from: '″', to: '"' },
    ]);
  });

  it('leaves text that needs nothing untouched and reports no change', () => {
    const result = winisdSafeText('Eminence Kappalite 3010LF 8 ohm');
    expect(result.text).toBe('Eminence Kappalite 3010LF 8 ohm');
    expect(result.changes).toEqual([]);
  });
});

describe('winisdSafeText — characters that render fine are let through', () => {
  // Observed rendering correctly in WinISD's driver editor: CP437 graphics, Latin-1, the
  // symbols openisd emits, and everything Windows font-links by script.
  const keep = 'ΩΩμµ²³·±×°'
    + '¼½¾®ρüØø√π'
    + '€▓░█│┼≡÷≈'
    + '中文Ж✓✗∀⊗℧₹ą'
    + '\u{1F600}';

  for (const ch of keep) {
    it(`U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')} is kept`, () => {
      const result = winisdSafeText(`a${ch}b`);
      expect(result.text).toBe(`a${ch}b`);
      expect(result.changes).toEqual([]);
    });
  }
});

describe('winisdSafeText — characters whose UTF-8 carries the 0xA4 newline marker', () => {
  it('transliterates a with diaeresis rather than dropping a letter', () => {
    const result = winisdSafeText('Visaton Wärme');
    expect(result.text).toBe('Visaton Waerme');
    expect(result.changes).toEqual([{ from: 'ä', to: 'ae' }]);
  });

  it('spells less-than-or-equal in ASCII', () => {
    const result = winisdSafeText('x≤y');
    expect(result.text).toBe('x<=y');
    expect(result.changes).toEqual([{ from: '≤', to: '<=' }]);
  });

  it('spells greater-than-or-equal too, so a comparison is not half-rewritten', () => {
    // U+2265 is E2 89 A5 — no marker byte, and CP437 0xF2 draws it. It goes only because its
    // partner does.
    const result = winisdSafeText('a≤b ≥c');
    expect(result.text).toBe('a<=b >=c');
    expect(result.changes).toEqual([
      { from: '≤', to: '<=' },
      { from: '≥', to: '>=' },
    ]);
  });

  it('marks one with no agreed replacement with an inverted question mark', () => {
    // John, 2026-09-25: a dropped character leaves no trace a reader can see. `¿` is C2 BF —
    // no 0xA4 — and sits at CP437 0xA8, so the OEM font draws it.
    const result = winisdSafeText('x∤y');
    expect(result.text).toBe('x¿y');
    expect(result.changes).toEqual([{ from: '∤', to: '¿' }]);
  });

  it.each([
    ['¤', 'CURRENCY SIGN', 'c2a4'],
    ['Τ', 'GREEK CAPITAL TAU', 'cea4'],
    ['Ф', 'CYRILLIC CAPITAL EF', 'd0a4'],
    ['₤', 'LIRA SIGN', 'e282a4'],
    ['┤', 'BOX DRAWINGS LIGHT VERTICAL AND LEFT', 'e294a4'],
    ['❤', 'HEAVY BLACK HEART', 'e29da4'],
    ['\u{1F924}', 'DROOLING FACE', 'f09fa4a4'],
  ])('replaces %s (%s, UTF-8 %s)', (ch) => {
    expect([...Buffer.from(ch, 'utf-8')]).toContain(0xa4);
    expect(winisdSafeText(`a${ch}b`).text).toBe('a¿b');
  });

  it('keeps the newline sentinel, which IS the marker', () => {
    const text = `line one${WINISD_NEWLINE_SENTINEL}line two`;
    const result = winisdSafeText(text);
    expect(result.text).toBe(text);
    expect(result.changes).toEqual([]);
  });
});

describe('winisdSafeText — the whole text', () => {
  it('applies every rule in one pass', () => {
    const result = winisdSafeText(
      'B&C “Speakers” – 18″ Ω ™ Wärme driver'
    );
    expect(result.text).toBe('B&C "Speakers" - 18" Ω (TM) Waerme driver');
  });

  it('is idempotent', () => {
    const once = winisdSafeText('“Dayton™” – Wärme').text;
    expect(winisdSafeText(once).text).toBe(once);
  });

  it('leaves the empty string alone', () => {
    expect(winisdSafeText('')).toEqual({ text: '', changes: [] });
  });
});
