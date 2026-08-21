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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { wdrBytesToText, wdrTextToBytes, WDR_NEWLINE_SENTINEL } from '../src/wdrBytes.js';
import { WinISDDriver } from '../src/winisdDriver.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const UNICODE_WDR = join(ROOT, 'drivers', 'sample', 'winisd', 'driver-with-unicode-text.wdr');

describe('the 0xA4 newline sentinel in a .wdr string field', () => {
  it("decodes WinISD's own unicode sample — Euro, Kanji and two embedded newlines", () => {
    const text = wdrBytesToText(new Uint8Array(readFileSync(UNICODE_WDR)));
    const comment = /^Comment=(.*)$/m.exec(text)?.[1];

    assert.equal(comment, `Euro €${WDR_NEWLINE_SENTINEL}Kanji 漢字${WDR_NEWLINE_SENTINEL}`,
      'both sentinels survive as sentinels, and the multi-byte characters around them are intact');
  });

  it('a 0xA4 INSIDE a multi-byte sequence is data, not a sentinel', () => {
    // U+00A4 (¤) encodes as C2 A4 — its second byte is 0xA4. A byte-for-byte substitution
    // would tear the character in half; only a lead-position test gets this right.
    const bytes = new Uint8Array([0x43, 0x3d, 0xc2, 0xa4, 0xa4, 0x78]); // "C=" ¤ <sentinel> "x"
    assert.equal(wdrBytesToText(bytes), `C=¤${WDR_NEWLINE_SENTINEL}x`);
  });

  it('bytes -> text -> bytes is the identity on a WinISD-written file', () => {
    const original = new Uint8Array(readFileSync(UNICODE_WDR));
    assert.deepEqual(wdrTextToBytes(wdrBytesToText(original)), original);
  });

  it('a multi-line Comment survives a full driver round trip and stays on one line', () => {
    const source = wdrBytesToText(new Uint8Array(readFileSync(UNICODE_WDR)));

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
