/**
 * `winISDDriverFromOpenISDDeviceJson` — `.wdr` (as read by `WinISDDriver.fromWdrIni`) into an
 * `OpenISDDeviceJson` record. `docs/design/WDR_LOGIC.md` "Loading `.wdr` INI text into OpenISD".
 *
 * Loading decision table (ParState mark × value):
 *   E + 0        → entered, value 0
 *   E + nonzero  → entered, value
 *   C + any      → nothing (derived, never stored)
 *   N + 0        → nothing
 *   N + nonzero  → entered, value  ← third-party writers copy WinISD's FillChar discipline
 *                                     but not its edit-tracking; the mark lies, the value is real
 *   absent       → nothing
 *
 * Each `.wdr` built via `WinISDDriver.fromWdrIni` (never `.build()`, which now requires the
 * full 48-key set — see `winisdDriver.ts`'s own tests for that contract) with a 49-char
 * ParState row: 'N' everywhere except the one slot the test cares about, by that key's own
 * position in `POS_TO_WDRKEY`.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { WinISDDriver } from '../../winisd/winisdDriver.js';
import { winISDDriverToOpenISDDeviceJson, openISDDeviceJsonSchema }
  from '../../domain/openisdSchema.js';

/** A 49-char ParState row, 'N' everywhere except the given slot. */
function parState(slot: number, mark: 'E' | 'C' | 'N'): string {
  const marks = new Array(49).fill('N');
  marks[slot] = mark;
  return marks.join('');
}

describe('winISDDriverFromOpenISDDeviceJson', () => {
  it('an ENTERED cell becomes a woofer spec entry carrying that value', () => {
    // No ParState row at all: presence alone reads as entered.
    const wdr = WinISDDriver.fromWdrIni('[Driver]\r\nFs=37.5\r\n');

    const { record } = winISDDriverToOpenISDDeviceJson(wdr);

    const fs = record.specs.woofer?.Fs;
    assert.ok(fs, 'expected a Fs spec entry');
    assert.equal(fs.origin, 'manual');
    assert.equal(fs.readings.manual?.read_value, 37.5);
  });

  it('a CALCULATED cell produces no spec entry — a calculated value is never stored', () => {
    // Vas is ParState slot 19.
    const wdr = WinISDDriver.fromWdrIni(`[Driver]\r\nVas=0\r\nParState=${parState(19, 'C')}\r\n`);

    const { record } = winISDDriverToOpenISDDeviceJson(wdr);

    assert.equal(record.specs.woofer?.Vas, undefined);
  });

  it('a NOT-AVAILABLE cell with value 0 produces no spec entry', () => {
    // Gloss is ParState slot 37; 'N' is the row's own default so this ParState is all-N.
    const wdr = WinISDDriver.fromWdrIni(`[Driver]\r\nGloss=0\r\nParState=${parState(37, 'N')}\r\n`);

    const { record } = winISDDriverToOpenISDDeviceJson(wdr);

    assert.equal(record.specs.woofer?.Gloss, undefined);
  });

  it('a NOT-AVAILABLE cell with a NONZERO value becomes an entered spec entry', () => {
    // Third-party tools copy WinISD's FillChar blank-driver discipline (N for un-touched fields)
    // but do not track edits, leaving real values under N marks. The mark lies; trust the value.
    // Fs is ParState slot 1.
    const wdr = WinISDDriver.fromWdrIni(`[Driver]\r\nFs=37.5\r\nParState=${parState(1, 'N')}\r\n`);

    const { record } = winISDDriverToOpenISDDeviceJson(wdr);

    const fs = record.specs.woofer?.Fs;
    assert.ok(fs, 'N+nonzero must produce a spec entry — the mark is unreliable, the value is real');
    assert.equal(fs.readings.manual?.read_value, 37.5);
  });

  it('Xlim never becomes a spec entry — its cell carries a mark and no real value', () => {
    // Xlim occupies ParState slot 10 and has no .wdr key of its own.
    const wdr = WinISDDriver.fromWdrIni(`[Driver]\r\nParState=${parState(10, 'E')}\r\n`);

    const { record } = winISDDriverToOpenISDDeviceJson(wdr);

    assert.equal(record.specs.woofer?.Xlim, undefined);
  });

  it('header text crosses verbatim; brand/manufacturer/model fall back to n/a when blank', () => {
    const withHeader = WinISDDriver.fromWdrIni(
      '[Driver]\r\nBrand=SEAS\r\nModel=19TAFD/G\r\nManufacturer=SEAS\r\n');
    const withoutHeader = WinISDDriver.fromWdrIni('[Driver]\r\n');

    const named = winISDDriverToOpenISDDeviceJson(withHeader).record;
    const unnamed = winISDDriverToOpenISDDeviceJson(withoutHeader).record;

    assert.equal(named.brand.value, 'SEAS');
    assert.equal(named.model.value, '19TAFD/G');
    assert.equal(named.manufacturer.value, 'SEAS');
    assert.equal(named.sku.value, '19TAFD/G');
    assert.equal(unnamed.brand.value, 'n/a');
    assert.equal(unnamed.model.value, 'n/a');
    assert.equal(unnamed.manufacturer.value, 'n/a');
  });

  it('providedBy/comment/dateAdded cross into provided_by/comment/added — not dropped', () => {
    // bugs/BUG_20260903_wdr_reader_drops_providedby_comment_dateadded_on_every_round_trip.md
    const wdr = WinISDDriver.fromWdrIni(
      '[Driver]\r\nProvidedBy=A Community Contributor\r\nComment=a note\r\nDateAdded=2026-09-01\r\n');

    const record = winISDDriverToOpenISDDeviceJson(wdr).record;

    assert.equal(record.provided_by?.value, 'A Community Contributor');
    assert.equal(record.comment?.value, 'a note');
    assert.equal(record.added?.value, '2026-09-01');
  });

  it('blank providedBy/comment/dateAdded produce no field, not an empty-string one', () => {
    const wdr = WinISDDriver.fromWdrIni('[Driver]\r\n');

    const record = winISDDriverToOpenISDDeviceJson(wdr).record;

    assert.equal(record.provided_by, undefined);
    assert.equal(record.comment, undefined);
    assert.equal(record.added, undefined);
  });

  it('driver_type is woofer; a fresh uuid is minted; the record conforms to the schema', () => {
    const wdr = WinISDDriver.fromWdrIni('[Driver]\r\nBrand=B\r\nModel=M\r\n');

    const a = winISDDriverToOpenISDDeviceJson(wdr).record;
    const b = winISDDriverToOpenISDDeviceJson(wdr).record;

    assert.equal(a.driver_type.value, 'woofer');
    assert.notEqual(a.uuid.value, b.uuid.value, 'each import mints its own record identity');
    assert.doesNotThrow(() => openISDDeviceJsonSchema.parse(a));
  });
});
