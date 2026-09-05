/**
 * `WinISDDriver` — import diffs, never overwrites (ARCHITECTURE.md §3 "`WinISDDriver` is
 * solely a serialisation device": "`.wdr` text populates a `WinISDDriver`; those as-read
 * values are diffed against what `OpenISDDriver` independently derives, surfacing a mismatch
 * — a value hand-edited in WinISD, for instance — as a data-quality signal rather than
 * silently overwriting").
 *
 * Seam under test: `WinISDDriver.fromWdrIni(text)` vs. `openIsdDriverToWinIsdDriver(driver, ...)`,
 * compared with `diffWdrValues`.
 */
import { describe, it } from 'vitest';
import { diffWdrValues } from './wdrDiff.js';
import assert from 'node:assert/strict';
import { WinISDDriver } from '@openisd/design/winisd';
import { conformingRecordToDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { openIsdDriverToWinIsdDriver } from '../../winisd/driverYmlToOpenisdAndWdr.js';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) => ({ origin: 'manual', readings: { manual: { read_value } } });

function recordDriver() {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped('Acme'), brand: scraped('Acme'), model: scraped('Widget'),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: 'ACME-WIDGET', grounds: [{ origin: 'manufacturer_datasheet', reading: 'ACME-WIDGET' }] },
    driver_type: scraped('woofer'),
    data_sources: { value: { manufacturer_datasheet: 'https://example.invalid/ds.pdf' } },
    authoritative: { value: 'manufacturer_datasheet' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        Fs: spec(40), Re: spec(6), Sd: spec(0.0133), Vas: spec(0.03),
        Qts: spec(0.4), Qes: spec(0.45),
      },
    },
  };
  const driver = conformingRecordToDriver(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return openIsdDriverToWinIsdDriver(driver, new Engine(), []);
}

describe('diffWdrValues — as-read values vs the independently-derived record', () => {
  it('reports no mismatch when the .wdr states exactly what the record derives', () => {
    const derived = recordDriver();
    const asRead = WinISDDriver.fromWdrIni(derived.toWdrIni());
    const mismatches = diffWdrValues(asRead, derived);
    assert.deepEqual(mismatches, []);
  });

  it('surfaces a stated value that disagrees with the record as a data-quality signal, not a silent overwrite', () => {
    const derived = recordDriver();
    // Hand-edit Fs in the .wdr text as if WinISD's own editor changed it after export.
    const edited = derived.toWdrIni().replace(/^Fs=40$/m, 'Fs=41.5');
    const asRead = WinISDDriver.fromWdrIni(edited);

    // The mismatch is REPORTED, not silently applied — diffWdrValues never mutates either side.
    const mismatches = diffWdrValues(asRead, derived);
    assert.equal(mismatches.length, 1);
    assert.equal(mismatches[0].field, 'Fs');
    assert.match(mismatches[0].message, /41\.5/);
    assert.match(mismatches[0].message, /40/);

    // Neither WinISDDriver was mutated by the diff.
    assert.equal(asRead.cell('Fs').value, '41.5');
    assert.equal(derived.cell('Fs').value, '40');
  });

  it('does not compare a field the .wdr never stated — only what it asserts', () => {
    const derived = recordDriver();
    // A .wdr the writer never touched Le on — Le is 0 by WinISD's own default, not-available,
    // and must not be treated as an asserted "0" that then falsely disagrees with anything.
    const asRead = WinISDDriver.fromWdrIni(derived.toWdrIni());
    assert.equal(asRead.cell('Le').state, 'not-available');
    const mismatches = diffWdrValues(asRead, derived);
    assert.equal(mismatches.some(m => m.field === 'Le'), false);
  });
});
