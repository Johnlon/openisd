import {describe, expect, it} from 'vitest';
import {WINISD_NEWLINE_SENTINEL} from '../../winisd/winisdBytes.js';
import {winisdSafeText} from '../../winisd/winisdSafeText.js';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import {parse, stringify as stringifyYaml} from 'yaml';
import {WinIsdDriverConverter} from '../../domain/winIsdDriverConverter.js';
import {createEngine} from '../../engine/index.js';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** The engine every projection in this file uses — factory settings, as the bridge's own. */
const engine = createEngine();

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'corpus');

/** A real `driver.yml`: Dayton CE28N-4, a woofer-section record carrying `scraper_meta`. */
function daytonDriverYml(): string {
  return readFileSync(join(FIXTURES, 'dayton-ce28n-4.driver.yml'), 'utf8');
}

describe('winisdSafeText', () => {
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

  describe('driverYmlToOpenisdAndWdr — WinISD-safe text', () => {
    /** The Dayton fixture with the offending characters injected into the free-text fields a
     *  scraper really fills, so both derived files are built from text a manufacturer site could
     *  genuinely have produced. */
    function daytonWithUnsafeText(): string {
      const record: unknown = parse(daytonDriverYml());
      if (!isRecord(record)) throw new Error('expected an object');
      const brand = record.brand;
      const model = record.model;
      if (!isRecord(brand) || !isRecord(model)) throw new Error('expected brand/model to be objects');
      brand.value = 'Dayton™ Wärme';
      model.value = 'CE28N–4 “Titanium” 1″';
      record.comment = { value: 'Xmax ≤ 2.5 mm … rated 90 dB' };
      return stringifyYaml(record);
    }

    it('translates the characters WinISD cannot draw out of openisd.json', () => {
      const { openisd } = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonWithUnsafeText());
      assert.ok(openisd !== null, 'the fixture must still project');

      for (const bad of ['™', '–', '“', '”', '″', '…', ' ']) {
        assert.ok(!openisd.includes(bad), `openisd.json still carries ${JSON.stringify(bad)}`);
      }
      assert.ok(openisd.includes('Dayton(TM)'), 'TM spelled out');
      assert.ok(openisd.includes('CE28N-4 \\"Titanium\\" 1\\"'), 'dashes and quotes are ASCII');
    });

    it('removes the 0xA4-carrying characters that would corrupt the .wdr', () => {
      const { openisd } = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonWithUnsafeText());
      assert.ok(openisd !== null);

      assert.ok(!openisd.includes('ä'), 'a-with-diaeresis is C3 A4 and tears a .wdr value in half');
      assert.ok(!openisd.includes('≤'), 'less-than-or-equal is E2 89 A4');
      assert.ok(openisd.includes('Waerme'), 'spelled the German way');
      assert.ok(openisd.includes('Xmax <= 2.5 mm'), 'spelled in ASCII');
    });

    it('leaves the .wdr free of them too, because it is built from the cleaned record', () => {
      const { wdr } = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonWithUnsafeText());
      assert.ok(wdr !== null, 'a woofer record must produce a .wdr');

      for (const bad of ['™', '–', '“', '”', '″', '…', ' ', 'ä', '≤']) {
        assert.ok(!wdr.includes(bad), `.wdr still carries ${JSON.stringify(bad)}`);
      }
    });

    it('reports every rewrite as a warn naming the field and both characters', () => {
      const { errors } = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonWithUnsafeText());
      const rewrites = errors.filter((e) => e.field.startsWith('winisd-safe-text'));

      assert.ok(rewrites.length > 0, 'a rewrite nobody is told about is a silent edit');
      assert.ok(rewrites.every((e) => e.level === 'warn'), 'cosmetic, never blocking');
      assert.ok(
        rewrites.some((e) => e.field === 'winisd-safe-text:brand.value' && e.message.includes('™') && e.message.includes('(TM)')),
        `expected a brand rewrite naming both sides, got: ${JSON.stringify(rewrites)}`
      );
    });

    it('says nothing about a record that needed no rewrite', () => {
      const { errors } = new WinIsdDriverConverter(engine).driverYmlToOpenisdAndWdr(daytonDriverYml());
      assert.deepEqual(errors.filter((e) => e.field.startsWith('winisd-safe-text')), []);
    });
  });
});
