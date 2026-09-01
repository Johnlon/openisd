/**
 * `WinISDDriver` — import diffs, never overwrites (ARCHITECTURE.md §3 "`WinISDDriver` is
 * solely a serialisation device": "`.wdr` text populates a `WinISDDriver`; those as-read
 * values are diffed against what `OpenISDDriver` independently derives, surfacing a mismatch
 * — a value hand-edited in WinISD, for instance — as a data-quality signal rather than
 * silently overwriting").
 *
 * Seam under test: `WinISDDriver.fromWdrIni(text).diffAgainst(WinISDDriver.fromOpenISDDriver(driver))`.
 */
import { describe, it } from 'vitest';
import { diffWdrValues } from './wdrDiff.js';
import assert from 'node:assert/strict';
import { parse } from 'yaml';
import { WinISDDriver } from '../../winisd/winisdDriver.js';
import { OpenISDDriver } from '@openisd/model';

const RECORD = `
uuid: {value: u1, definition: d}
quality: {rating: M, confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [], parse_errors: [], cross_source_only: []}
manufacturer: {value: Acme, origin: manual, definition: d, dq: []}
brand: {value: Acme, origin: manual, definition: d, dq: []}
model: {value: Widget, origin: manual, definition: d, dq: []}
sku: {value: acme-widget, definition: d, grounds: []}
driver_type: {value: woofer, origin: manual, definition: d, dq: []}
disposition: {value: ok, definition: d, detail: ''}
data_sources: {value: {}, definition: d}
authoritative: {value: manual, definition: d}
specs:
  woofer:
    Fs: {origin: manual, readings: {manual: {read_value: 40}}, dq: []}
    Re: {origin: manual, readings: {manual: {read_value: 6}}, dq: []}
    Sd: {origin: manual, readings: {manual: {read_value: 0.0133}}, dq: []}
    Vas: {origin: manual, readings: {manual: {read_value: 0.03}}, dq: []}
    Qts: {origin: manual, readings: {manual: {read_value: 0.4}}, dq: []}
    Qes: {origin: manual, readings: {manual: {read_value: 0.45}}, dq: []}
`;

function recordDriver(): WinISDDriver {
  const { value } = OpenISDDriver.fromJsonRecord(parse(RECORD)).toWinISDDriver();
  if (!value) throw new Error('fixture record failed to project');
  return value;
}

describe('WinISDDriver.diffAgainst — as-read values vs the independently-derived record', () => {
  it('reports no mismatch when the .wdr states exactly what the record derives', () => {
    const derived = recordDriver();
    const asRead = WinISDDriver.fromWdrIni(derived.toWdr());
    const mismatches = diffWdrValues(asRead, derived);
    assert.deepEqual(mismatches, []);
  });

  it('surfaces a stated value that disagrees with the record as a data-quality signal, not a silent overwrite', () => {
    const derived = recordDriver();
    // Hand-edit Fs in the .wdr text as if WinISD's own editor changed it after export.
    const edited = derived.toWdr().replace(/^Fs=40$/m, 'Fs=41.5');
    const asRead = WinISDDriver.fromWdrIni(edited);

    // The mismatch is REPORTED, not silently applied — diffAgainst never mutates either side.
    const mismatches = diffWdrValues(asRead, derived);
    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0].field, 'Fs');
    assert.match(mismatches[0].message, /41\.5/);
    assert.match(mismatches[0].message, /40/);

    // Neither WinISDDriver was mutated by the diff.
    assert.equal(asRead.cell('Fs').value, '41.5');
    assert.equal(derived.cell('Fs').value, '40');
  });

  it('does not compare a field the .wdr never stated (state N) — only what it asserts (E)', () => {
    const derived = recordDriver();
    // A .wdr the writer never touched Le on — Le is 0 by WinISD's own default, state N, and
    // must not be treated as an asserted "0" that then falsely disagrees with anything.
    const asRead = WinISDDriver.fromWdrIni(derived.toWdr());
    assert.equal(asRead.cell('Le').state, 'N');
    const mismatches = diffWdrValues(asRead, derived);
    assert.equal(mismatches.some(m => m.field === 'Le'), false);
  });
});
