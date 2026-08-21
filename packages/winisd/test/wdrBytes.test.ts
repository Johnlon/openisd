/**
 * The `.wdr` byte boundary — WinISD's `0xA4` newline sentinel inside a string field.
 *
 * Oracle: `drivers/sample/winisd/driver-with-unicode-text.wdr`, written by WinISD itself, whose
 * `Comment=` carries a Euro sign, Kanji, and two sentinels on ONE physical line. It is the case
 * that separates a correct decoder from a byte-for-byte substitution: the file is UTF-8, so a
 * naive replace would have to reason about `0xA4` appearing inside a multi-byte sequence.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { wdrBytesToText, wdrTextToBytes, WDR_NEWLINE_SENTINEL, WdrEncoding } from '../src/wdrBytes.js';
import { WinISDDriver } from '../src/winisdDriver.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const UNICODE_WDR = join(ROOT, 'drivers', 'sample', 'winisd', 'driver-with-unicode-text.wdr');
const BUNDLED_WINISD_DIR = join(ROOT, 'drivers', 'winisd');
const SELENIUM_SW108_WDR = join(BUNDLED_WINISD_DIR, 'Selenium SW108 .wdr');
const AUDIOPIPE_TS_A10_WDR = join(BUNDLED_WINISD_DIR, 'Audiopipe TS-A10.wdr');
const DAI_ICHI_SIS8000_WDR = join(BUNDLED_WINISD_DIR, 'Dai-Ichi SIS8000.wdr');
const DAI_ICHI_SP65_40_WDR = join(BUNDLED_WINISD_DIR, 'Dai-Ichi SP65-40.wdr');

describe('the 0xA4 newline sentinel in a .wdr string field', () => {
  it("decodes WinISD's own unicode sample — Euro, Kanji and two embedded newlines", () => {
    const { text, encoding } = wdrBytesToText(new Uint8Array(readFileSync(UNICODE_WDR)));
    const comment = /^Comment=(.*)$/m.exec(text)?.[1];

    assert.equal(encoding, WdrEncoding.Utf8, "WinISD's own sample is valid UTF-8");
    assert.equal(comment, `Euro €${WDR_NEWLINE_SENTINEL}Kanji 漢字${WDR_NEWLINE_SENTINEL}`,
      'both sentinels survive as sentinels, and the multi-byte characters around them are intact');
  });

  it('a 0xA4 INSIDE a multi-byte sequence is data, not a sentinel', () => {
    // U+00A4 (¤) encodes as C2 A4 — its second byte is 0xA4. A byte-for-byte substitution
    // would tear the character in half; only a lead-position test gets this right.
    const bytes = new Uint8Array([0x43, 0x3d, 0xc2, 0xa4, 0xa4, 0x78]); // "C=" ¤ <sentinel> "x"
    const { text, encoding } = wdrBytesToText(bytes);
    assert.equal(encoding, WdrEncoding.Utf8);
    assert.equal(text, `C=¤${WDR_NEWLINE_SENTINEL}x`);
  });

  it('bytes -> text -> bytes is the identity on a WinISD-written file', () => {
    const original = new Uint8Array(readFileSync(UNICODE_WDR));
    assert.deepEqual(wdrTextToBytes(wdrBytesToText(original).text), original);
  });

  it('a multi-line Comment survives a full driver round trip and stays on one line', () => {
    const source = wdrBytesToText(new Uint8Array(readFileSync(UNICODE_WDR))).text;

    const driver = WinISDDriver.fromWdrIni(source);
    assert.equal(driver.headerField('comment'), 'Euro €\nKanji 漢字\n',
      'the parser hands the caller REAL newlines — the sentinel is a file-format detail');

    const written = driver.toWdr();
    const commentLines = written.split(/\r\n/).filter(l => l.startsWith('Comment='));
    assert.equal(commentLines.length, 1, 'the comment occupies exactly one physical line');
    assert.equal(commentLines[0],
      `Comment=Euro €${WDR_NEWLINE_SENTINEL}Kanji 漢字${WDR_NEWLINE_SENTINEL}`);
  });

  it('appended [DQ] lines are encoded too — they are newlines in the comment like any other', () => {
    const driver = WinISDDriver.build(
      { brand: 'B', model: 'M', comment: 'a driver' }, new Map(),
      ['[DQ] Qts=1.5: above max 0.8'],
    );
    const line = driver.toWdr().split(/\r\n/).find(l => l.startsWith('Comment='));

    assert.equal(line, `Comment=a driver${WDR_NEWLINE_SENTINEL}[DQ] Qts=1.5: above max 0.8`);
  });
});

describe('CP1252 fallback for a .wdr that is not valid UTF-8 (QO62)', () => {
  it('bytes that are not valid UTF-8 decode whole-file as CP1252, and report that encoding', () => {
    // 0x95 bullet, 0xAE (R), 0xB1 +/-, 0xBD 1/2 - none of these is a valid UTF-8 lead or
    // continuation byte in this arrangement, so a strict UTF-8 decode must fail here.
    const bytes = new Uint8Array([0x95, 0xae, 0xb1, 0xbd]);
    const { text, encoding } = wdrBytesToText(bytes);

    assert.equal(encoding, WdrEncoding.Cp1252);
    assert.equal(text, '•®±½', 'bullet, (R), +/-, 1/2 per the CP1252 code page');
  });

  it('the CP1252 fallback still recognises 0xA4 as the newline sentinel, whole-file, not per-line', () => {
    const bytes = new Uint8Array([0x41, 0xa4, 0x95, 0xa4, 0x42]); // "A" <sentinel> bullet <sentinel> "B"
    const { text, encoding } = wdrBytesToText(bytes);

    assert.equal(encoding, WdrEncoding.Cp1252);
    assert.equal(text, `A${WDR_NEWLINE_SENTINEL}•${WDR_NEWLINE_SENTINEL}B`);
  });

  it('the real Selenium SW108 fixture is not valid UTF-8 and reads back with (R) (0xAE) intact', () => {
    const { text, encoding } = wdrBytesToText(new Uint8Array(readFileSync(SELENIUM_SW108_WDR)));

    assert.equal(encoding, WdrEncoding.Cp1252, 'the fixture fails a strict UTF-8 decode');
    assert.ok(text.includes('Kapton®'), "'Kapton(R)' survives with the (R) intact");
    // The file's FF FF / E6 run is source damage — spliced mid-word into "reproduction" in
    // every encoding — and is deliberately NOT asserted on here (QO62: not an encoding oracle).
  });

  it('the bundled Audiopipe TS-A10 fixture (0x95) reads back with the bullet intact', () => {
    const { text, encoding } = wdrBytesToText(new Uint8Array(readFileSync(AUDIOPIPE_TS_A10_WDR)));
    assert.equal(encoding, WdrEncoding.Cp1252, 'the fixture fails a strict UTF-8 decode');
    assert.ok(text.includes('•'), "0x95 decodes to the CP1252 bullet, not a C1 control or U+FFFD");
  });

  it('the bundled Dai-Ichi SIS8000 fixture (0xB1) reads back with +/- intact', () => {
    const { text, encoding } = wdrBytesToText(new Uint8Array(readFileSync(DAI_ICHI_SIS8000_WDR)));
    assert.equal(encoding, WdrEncoding.Cp1252, 'the fixture fails a strict UTF-8 decode');
    assert.ok(text.includes('±'), '0xB1 decodes to the CP1252 plus-minus sign');
  });

  it('the bundled Dai-Ichi SP65-40 fixture (0xBD) reads back with 1/2 intact', () => {
    const { text, encoding } = wdrBytesToText(new Uint8Array(readFileSync(DAI_ICHI_SP65_40_WDR)));
    assert.equal(encoding, WdrEncoding.Cp1252, 'the fixture fails a strict UTF-8 decode');
    assert.ok(text.includes('½'), '0xBD decodes to the CP1252 one-half sign');
  });

  it('a genuine CP1252 currency sign (0xA4) is accepted loss: it reads back as the newline sentinel', () => {
    // 0xA4 is ambiguous in CP1252 - it is both the currency sign and WinISD's own newline
    // byte. The wine probe behind the QO62 ruling established that WinISD itself writes a
    // bare 0xA4 for an Enter keystroke, so every 0xA4 is read as the sentinel; a real
    // standalone currency sign, if one exists in a CP1252 file, is lost to this reading.
    // 0xAE (a lone CP1252 (R)) forces the CP1252 branch, since on its own it is not valid UTF-8.
    const bytes = new Uint8Array([0x50, 0x72, 0x69, 0x63, 0x65, 0x3a, 0x20, 0xa4, 0x31, 0x30, 0xae]); // "Price: <curr>10" (R)
    const { text, encoding } = wdrBytesToText(bytes);

    assert.equal(encoding, WdrEncoding.Cp1252);
    assert.equal(text, `Price: ${WDR_NEWLINE_SENTINEL}10®`);
  });

  it('every non-UTF-8 bundled .wdr decodes as CP1252 with no replacement character', () => {
    const wdrFiles = readdirSync(BUNDLED_WINISD_DIR).filter(f => f.endsWith('.wdr'));
    assert.ok(wdrFiles.length > 0, 'sanity: the bundled directory is not empty');

    const nonUtf8: string[] = [];
    for (const f of wdrFiles) {
      const { text, encoding } = wdrBytesToText(new Uint8Array(readFileSync(join(BUNDLED_WINISD_DIR, f))));
      if (encoding === WdrEncoding.Cp1252) {
        nonUtf8.push(f);
        assert.ok(!text.includes('�'), `${f}: CP1252 decode produced a replacement character`);
      }
    }

    assert.ok(nonUtf8.length > 0, 'the CP1252 path is still exercised by real bundled data');
  });
});
