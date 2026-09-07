/**
 * `[ENV T=<kelvin> p=<pascal> RH=<percent>]` in a `.wdr`'s `Comment=` — the environment `c`/
 * `roo` were computed under, for a driver-only `.wdr` (no other field can carry it; see
 * `bugs/BUG_20260907_wdr_c_roo_environment_not_recoverable_on_round_trip.md`).
 *
 * Real WinISD never writes or reads this tag — it is OpenISD's own convention, round-tripped
 * only through `WinISDDriver` itself. A file with no tag is unaffected: `WinISDDriver.build()`
 * with no `env` argument writes no tag, and `fromWdrIni()` on an untagged file reads `env` as
 * `undefined`.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { WinISDDriver, INI_ROWS } from '../../winisd/winisdDriver.js';
import type { WdrCell } from '../../winisd/winisdDriver.js';
import { WINISD_NEWLINE_SENTINEL } from '../../winisd/winisdBytes.js';

function allZeroCells(): Map<string, WdrCell> {
  const cells = new Map<string, WdrCell>();
  for (const key of INI_ROWS) cells.set(key, { value: '0', state: 'not-available' });
  return cells;
}

describe('WinISDDriver [ENV] tag — write side', () => {
  it('build() with an env writes [ENV T=... p=... RH=...] onto Comment=', () => {
    const driver = WinISDDriver.build(
      { comment: 'hello' },
      allZeroCells(),
      [],
      { tempK: 283.15, pressurePa: 161325, humidityPct: 35 },
    );
    const text = driver.toWdrIni();
    const commentLine = text.split(/\r?\n/).find(l => l.startsWith('Comment='));
    assert.equal(commentLine, `Comment=hello${WINISD_NEWLINE_SENTINEL}[ENV T=283.15 p=161325 RH=35]`);
  });

  it('build() with no env writes no tag, and Comment= is unchanged', () => {
    const driver = WinISDDriver.build({ comment: 'hello' }, allZeroCells(), []);
    const text = driver.toWdrIni();
    const commentLine = text.split(/\r?\n/).find(l => l.startsWith('Comment='));
    assert.equal(commentLine, 'Comment=hello');
  });

  it('build() with no comment and an env writes only the tag, no leading blank line', () => {
    const driver = WinISDDriver.build(
      {},
      allZeroCells(),
      [],
      { tempK: 293.15, pressurePa: 101325, humidityPct: 30 },
    );
    const text = driver.toWdrIni();
    const commentLine = text.split(/\r?\n/).find(l => l.startsWith('Comment='));
    assert.equal(commentLine, 'Comment=[ENV T=293.15 p=101325 RH=30]');
  });
});

describe('WinISDDriver [ENV] tag — read side', () => {
  it('fromWdrIni() parses an [ENV] tag out of Comment= into env()', () => {
    const written = WinISDDriver.build(
      { comment: 'hello' },
      allZeroCells(),
      [],
      { tempK: 283.15, pressurePa: 161325, humidityPct: 35 },
    ).toWdrIni();

    const read = WinISDDriver.fromWdrIni(written);
    assert.deepEqual(read.env(), { tempK: 283.15, pressurePa: 161325, humidityPct: 35 });
  });

  it('fromWdrIni() on a file with no [ENV] tag reads env() as undefined', () => {
    const written = WinISDDriver.build({ comment: 'hello' }, allZeroCells(), []).toWdrIni();
    const read = WinISDDriver.fromWdrIni(written);
    assert.equal(read.env(), undefined);
  });

  it('fromWdrIni() keeps the rest of Comment= intact alongside the tag', () => {
    const written = WinISDDriver.build(
      { comment: 'a real note' },
      allZeroCells(),
      [],
      { tempK: 283.15, pressurePa: 161325, humidityPct: 35 },
    ).toWdrIni();

    const read = WinISDDriver.fromWdrIni(written);
    assert.equal(read.headerField('comment'), 'a real note\n[ENV T=283.15 p=161325 RH=35]');
  });
});

describe('WinISDDriver [ENV] tag — round trip through a real oracle file', () => {
  it('a tag hand-added to a real WinISD file survives fromWdrIni -> toWdrIni unchanged', () => {
    const commentLine = `Comment=note${WINISD_NEWLINE_SENTINEL}[ENV T=283.15 p=161325 RH=35]`;
    const header = ['Brand=', 'Model=', 'Manufacturer=', 'ProvidedBy=', commentLine,
      'DateAdded=', 'DateModified='].join('\r\n');
    const text = `[Driver]\r\n${header}\r\n${INI_ROWS.map(k => `${k}=0\r\n`).join('')}`
      + `ParState=${'N'.repeat(49)}\r\n`;
    const read = WinISDDriver.fromWdrIni(text);
    assert.deepEqual(read.env(), { tempK: 283.15, pressurePa: 161325, humidityPct: 35 });
    assert.equal(read.toWdrIni(), text);
  });
});
