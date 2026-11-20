/**
 * The driver summary (library preview, Driver tab Info) lists every spec field a driver holds,
 * stated and calculated (John, 20 Nov 2026: "the driver info screen has many known params missing
 * (SB Acoustics SB23NRXS45-4 8" Woofer) sensitivity for instance, many").
 */
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {describe, expect, it} from 'vitest';
import {createEngine} from '@openisd/design/engine';
import {OpenISDDriver} from '../../domain/driver/openISDDriver.js';
import {driverInfoRows} from '../../domain/driver/driverInfoRows.js';

const RECORD = join(__dirname, '..', '..', '..', 'ui', 'public', 'drivers', 'sb-acoustics', 'sb23nrxs45-4.json');

/** The spec keys of the record file's woofer section, read as plain JSON. */
function wooferKeys(): string[] {
  const parsed: unknown = JSON.parse(readFileSync(RECORD, 'utf8'));
  const specs: unknown = typeof parsed === 'object' && parsed !== null && 'specs' in parsed ? parsed.specs : null;
  const woofer: unknown = typeof specs === 'object' && specs !== null && 'woofer' in specs ? specs.woofer : null;
  if (typeof woofer !== 'object' || woofer === null) throw new Error('record has no woofer section');
  return Object.keys(woofer);
}

function sb23(): OpenISDDriver {
  const driver = OpenISDDriver.fromConformingRecord(JSON.parse(readFileSync(RECORD, 'utf8')), createEngine());
  if (Array.isArray(driver)) throw new Error(driver.join('; '));
  return driver;
}

describe('driverInfoRows', () => {
  it('lists every spec field the SB23NRXS45-4 record holds, one row each', () => {
    const keys = driverInfoRows(sb23()).map(r => r.key);
    expect([...keys].sort()).toEqual(wooferKeys().sort());
  });

  it('shows the stated sensitivity as SPL 92 dB, marked stated', () => {
    const spl = driverInfoRows(sb23()).find(r => r.key === 'SPL_dB');
    expect(spl).toMatchObject({label: 'SPL', unit: 'dB', provenance: 'E'});
    expect(spl?.value).toMatch(/^92(\.0+)?$/);
  });

  it('marks a calculated field as calculated', () => {
    expect(driverInfoRows(sb23()).find(r => r.key === 'USPL_dB')?.provenance).toBe('C');
  });

  it('keeps the Thiele/Small set first, in its existing order', () => {
    expect(driverInfoRows(sb23()).slice(0, 12).map(r => r.label))
      .toEqual(['Fs', 'Qts', 'Qes', 'Qms', 'Re', 'BL', 'Le', 'Vas', 'Sd', 'Xmax', 'Pe', 'Znom']);
  });

  it('formats in the display unit: Xmax 6.50 mm, weight 2.74 kg', () => {
    const rows = driverInfoRows(sb23());
    expect(rows.find(r => r.key === 'Xmax_m')).toMatchObject({value: '6.50', unit: 'mm'});
    expect(rows.find(r => r.key === 'weight_kg')).toMatchObject({unit: 'kg'});
    expect(rows.find(r => r.key === 'weight_kg')?.value).toMatch(/^2\.74/);
  });
});
