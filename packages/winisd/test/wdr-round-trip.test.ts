/**
 * `WinISDDriver` — reading a `.wdr` and writing it back reproduces the file, byte for byte.
 *
 * One assertion, over every file WinISD itself wrote:
 *
 *     WinISDDriver.fromWdr(text).toWdr() === text
 *
 * Byte equality needs no list of which fields to check, and so cannot be wrong about one.
 *
 * 🔒 ORACLE: `drivers/sample/winisd/` — every file there was written by WinISD.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WinISDDriver } from '@openisd/winisd';

const here = dirname(fileURLToPath(import.meta.url));
const SAMPLES = join(here, '..', '..', '..', 'drivers', 'sample', 'winisd');

const files = readdirSync(SAMPLES)
  .filter(f => f.endsWith('.wdr'))
  .filter(f => /\[Driver\]/.test(readFileSync(join(SAMPLES, f), 'utf8')));

describe('a .wdr survives fromWdr → toWdr byte for byte', () => {
  it('the sample corpus is the oracle, and it is not empty', () => {
    assert.ok(files.length > 3,
      'this suite proves nothing without files WinISD wrote to compare against');
  });

  for (const file of files) {
    it(`${file} round-trips unchanged`, () => {
      const src = readFileSync(join(SAMPLES, file), 'utf8');
      const out = WinISDDriver.fromWdr(src).toWdr();

      if (out === src) return;

      // Report the FIRST real difference rather than dumping two files: a diff of 58 lines
      // where one differs is unreadable, and the line number is what identifies the defect.
      const a = src.split(/\r?\n/), b = out.split(/\r?\n/);
      const endings = src.includes('\r\n') !== out.includes('\r\n')
        ? `line endings differ (src ${src.includes('\r\n') ? 'CRLF' : 'LF'}, out ${out.includes('\r\n') ? 'CRLF' : 'LF'}); `
        : '';
      const i = a.findIndex((l, n) => l !== b[n]);
      const detail = i < 0
        ? `line count ${a.length} vs ${b.length}`
        : `line ${i}: "${a[i]}" -> "${b[i] ?? '<missing>'}"`;
      assert.fail(`${file} did not round-trip: ${endings}${detail}`);
    });
  }
});

/**
 * Xlim crosses a `.wdr` as its ParState slot-10 MARK and nothing else.
 *
 * WinISD offers Xlim in its UI and then fails to save it — a WinISD bug, recorded in
 * `s-xlim-123.wdr`'s own comment ("Xlim Entered = 123 but does not save to file - it may set
 * the ParState flag") and visible as slot 10 = `E` with every numeric line still `0`.
 *
 * We reproduce the bug rather than route around it. `.wdr` has no extension mechanism, so an
 * `Xlim=` line is a key WinISD cannot read: it would be dropped the moment WinISD saved over
 * the file, while slot 10 went on claiming a value was entered — and it would break the byte
 * comparison against WinISD's own output that the projection work depends on.
 *
 * Recorded in `drivers/sample/PARSTATE-FINDINGS.md` §"WinISD save bugs".
 */
describe('an Xlim= line is not part of the format', () => {
  it('no file WinISD wrote contains one', () => {
    const offenders = files.filter(f => /^Xlim=/m.test(readFileSync(join(SAMPLES, f), 'utf8')));
    assert.deepEqual(offenders, [],
      'the premise of dropping the line is that WinISD never writes it');
  });

  it('the slot-10 mark survives, which is all there is to survive', () => {
    const src = readFileSync(join(SAMPLES, 's-xlim-123.wdr'), 'utf8');
    const parState = (t: string): string =>
      t.split(/\r?\n/).find(l => l.startsWith('ParState='))!.slice('ParState='.length);

    assert.equal(parState(src)[10], 'E', 'precondition: the source marks Xlim entered');
    const out = WinISDDriver.fromWdr(src).toWdr();
    assert.equal(parState(out)[10], 'E');
    assert.equal(/^Xlim=/m.test(out), false, 'and no value line is invented to go with it');
  });
});
