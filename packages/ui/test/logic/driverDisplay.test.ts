/**
 * `driverDisplay.ts` — display/search logic for one driver: what it is called, and what
 * classification chips it gets. Domain fact (a T/S parameter, a stated `driver_type`) lives on
 * the driver itself; this file's job is turning those facts into UI-facing strings, which is
 * not domain logic.
 */
import { describe, it } from 'vitest';
import assert from 'node:assert/strict';
import { conformingRecordToDriver } from '@openisd/design';
import { Engine } from '@openisd/design/engine';
import { displayNameOf, chipsOf } from '../../src/logic/driverDisplay.js';

const scraped = <T,>(value: T) => ({ value });
const spec = (read_value: number) => ({ origin: 'manual', readings: { manual: { read_value } } });

function driverOf(p: {
  brand: string; model: string; driverType?: string;
  Fs?: number; Sd?: number;
}) {
  const record = {
    uuid: { value: '00000000-0000-4000-8000-000000000000' },
    manufacturer: scraped(p.brand), brand: scraped(p.brand), model: scraped(p.model),
    provided_by: scraped('test'), comment: scraped(''), added: scraped('2026-01-01'),
    sku: { value: '', grounds: [{ origin: 'manufacturer_datasheet', reading: '' }] },
    driver_type: scraped(p.driverType ?? ''),
    data_sources: { value: {} },
    authoritative: { value: 'manual' },
    quality: {
      confirmed_fields: [], fields_with_issues: [], missing: [], invalid: [],
      parse_errors: [], cross_source_only: [],
    },
    specs: {
      woofer: {
        ...(p.Fs != null ? { Fs: spec(p.Fs) } : {}),
        ...(p.Sd != null ? { Sd: spec(p.Sd) } : {}),
      },
    },
  };
  const driver = conformingRecordToDriver(record, new Engine());
  if (Array.isArray(driver)) throw new Error(`fixture is not a valid driver: ${driver.join(', ')}`);
  return driver;
}

describe('displayNameOf — what a driver is called on screen', () => {
  it('joins brand and model with a space', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'RS225' });
    assert.equal(displayNameOf(driver), 'Dayton RS225');
  });

  it('falls back to "Driver" when both brand and model are empty', () => {
    const driver = driverOf({ brand: '', model: '' });
    assert.equal(displayNameOf(driver), 'Driver');
  });

  it('uses whichever of brand/model is present, alone, when the other is empty', () => {
    const driver = driverOf({ brand: 'Dayton', model: '' });
    assert.equal(displayNameOf(driver), 'Dayton');
  });
});

describe('chipsOf — classification chips for one driver', () => {
  it('a canonical stated driver_type wins outright', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'RS225-8', driverType: 'woofer' });
    const { canonical } = chipsOf(driver);
    assert.equal(canonical, 'Woofer');
  });

  it('falls back to the name when driver_type is not a canonical value', () => {
    const driver = driverOf({ brand: 'Dayton', model: 'DT-25 Tweeter' });
    const { canonical } = chipsOf(driver);
    assert.equal(canonical, 'Tweeter');
  });

  it('falls back to T/S parameters when neither driver_type nor the name resolves it', () => {
    const driver = driverOf({ brand: 'Acme', model: 'X1', Fs: 30, Sd: 0.001 });
    const { canonical } = chipsOf(driver);
    // Sd in cm² < 12 resolves to Tweeter by the T/S fallback (Sd = 0.001 m² = 10 cm²).
    assert.equal(canonical, 'Tweeter');
  });
});
