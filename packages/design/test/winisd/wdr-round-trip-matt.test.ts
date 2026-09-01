/**
 * The Matt corpus — 423 `.wdr` files from a third party — survives `fromWdrIni → toWdr` byte
 * for byte.
 *
 * Separate from `wdr-round-trip.test.ts` because the corpora are not equally understood.
 * `drivers/sample/winisd/` is OUR probe set: every file was produced by a known experiment,
 * so a failure there is unambiguous. These are somebody else's files. They exercise shapes no
 * probe covers — real brands, real comments, values across the whole numeric range — which is
 * exactly what makes them worth running, but a failure here needs the file examined before it
 * is called a defect in the writer.
 *
 * 🔒 ORACLE: `drivers/matt/` — third-party WinISD saves, not written by this project.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDDriver } from '@openisd/design/winisd';

const here = dirname(fileURLToPath(import.meta.url));
const CORPUS = join(here, '..', '..', '..', '..', 'drivers', 'matt');

const files = readdirSync(CORPUS).filter(f => f.endsWith('.wdr'));

/** `Key=value` lines in file order. `[Driver]` and the trailing blank carry no pair. */
function pairs(text: string): Map<string, string> {
  return new Map(text.split(/\r?\n/)
    .filter(l => l.includes('=') && l[0] !== '[')
    .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
}

describe('the Matt corpus round-trips without corruption', () => {
  it('the corpus is present and large', () => {
    assert.ok(files.length > 100,
      `this suite proves nothing without the corpus — found ${files.length} files`);
  });

  // One `it` per file: 423 named results say WHICH file broke, where a single loop would
  // report only the first and hide how many others share the fault.
  for (const file of files) {
    it(`${file}`, () => {
      const src = readFileSync(join(CORPUS, file), 'utf8');
      const out = WinISDDriver.fromWdrIni(src).toWdr();
      if (out === src) return;

      // Not byte-identical. The ONLY difference allowed is keys the source predates: four of
      // these files were saved by an older WinISD that wrote a smaller key set (three carry no
      // `Brand=`; `B&C  6PE13.wdr` carries neither `VCCon=` nor `ParState=`). Our writer emits
      // the current key set, which is what WinISD itself does when it re-saves such a file.
      //
      // So absence is allowed to become presence — and nothing else is. A key that vanishes or
      // a value that shifts is corruption whatever the corpus, and is what these three
      // assertions pin. Line endings are checked separately because a whole-file CRLF→LF slip
      // changes no pair and would otherwise pass unnoticed.
      const a = pairs(src), b = pairs(out);

      assert.equal(out.includes('\r\n'), src.includes('\r\n'), `${file}: line endings changed`);

      const dropped = [...a.keys()].filter(k => !b.has(k));
      assert.deepEqual(dropped, [], `${file}: keys were dropped`);

      const changed = [...a.keys()].filter(k => b.get(k) !== a.get(k))
        .map(k => `${k}: "${a.get(k)}" -> "${b.get(k)}"`);
      assert.deepEqual(changed, [], `${file}: values changed`);

      assert.deepEqual([...b.keys()].filter(k => a.has(k)), [...a.keys()],
        `${file}: key ORDER changed — WinISD writes a fixed order and reads by position`);
    });
  }
});
